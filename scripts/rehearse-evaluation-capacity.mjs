import assert from "node:assert/strict";
import { setTimeout as wait } from "node:timers/promises";

const origin = new URL(process.argv[2]);
const expected = Number(process.argv[3] || 50);
assert.ok(Number.isInteger(expected) && expected >= 1 && expected <= 50);
assert.ok(
  origin.origin === "https://advisio-tam-evaluation-2026.onrender.com" ||
    (origin.protocol === "http:" && origin.hostname === "127.0.0.1"),
  "Use the dedicated ADVISIO evaluation or a local disposable instance.",
);

async function request(
  endpoint,
  {
    cookie,
    body,
    method = body ? "POST" : "GET",
    status = 200,
    pdf = false,
  } = {},
) {
  const started = performance.now();
  const response = await fetch(new URL(endpoint, origin), {
    method,
    redirect: "manual",
    signal: AbortSignal.timeout(35_000),
    headers: {
      Origin: origin.origin,
      ...(cookie && { Cookie: cookie }),
      ...(body && { "Content-Type": "application/json" }),
    },
    ...(body && { body: JSON.stringify(body) }),
  });
  const raw = Buffer.from(await response.arrayBuffer());
  const json = response.headers
    .get("content-type")
    ?.includes("application/json")
    ? JSON.parse(raw.toString())
    : null;
  assert.equal(
    response.status,
    status,
    `${method} ${endpoint}: HTTP ${response.status}`,
  );
  if (pdf) assert.equal(raw.subarray(0, 5).toString(), "%PDF-");
  return {
    json,
    cookie: response.headers.getSetCookie()[0]?.split(";")[0],
    elapsed: performance.now() - started,
  };
}

async function healthy() {
  assert.deepEqual((await request("/api/health")).json, {
    status: "ok",
    mode: "evaluation",
    database: "connected",
  });
}

async function preparedCourses() {
  let previous = -1;
  for (let attempt = 0; attempt < 180; attempt++) {
    const { json } = await request("/api/evaluation/capacity");
    assert.equal(
      json?.enabled,
      true,
      "Enable EVALUATION_PREWARM before the rehearsal.",
    );
    assert.equal(json.maxActive, expected);
    assert.equal(
      json.active,
      0,
      "Wait until respondents finish before the rehearsal.",
    );
    assert.equal(
      json.courses.reduce((sum, { target }) => sum + target, 0),
      expected,
    );
    const ready = json.courses.reduce((sum, course) => sum + course.ready, 0);
    if (ready !== previous)
      console.log(`Prepared ${ready}/${expected} workspaces`);
    previous = ready;
    if (ready === expected)
      return json.courses.flatMap(({ course, ready }) =>
        Array(ready).fill(course),
      );
    await wait(15_000);
  }
  throw new Error("Workspace preparation did not finish within 45 minutes.");
}

async function visitor() {
  const { cookie, json } = await request("/api/evaluation/config");
  assert.match(cookie || "", /^advisio_evaluation=[0-9a-f]{64}$/);
  assert.equal(json.entryUrl, new URL("/evaluate", origin).href);
  return { cookie, roles: json.roles.map(({ id }) => id) };
}

async function all(label, operations) {
  const results = await Promise.allSettled(operations);
  const failures = results.filter(({ status }) => status === "rejected");
  if (failures.length) {
    const sample = [
      ...new Set(failures.map(({ reason }) => reason.message)),
    ].slice(0, 5);
    throw new Error(
      `${label}: ${results.length - failures.length}/${results.length} passed. ${sample.join(" | ")}`,
    );
  }
  return results.map(({ value }) => value);
}

function timings(values) {
  const sorted = values.toSorted((a, b) => a - b);
  return {
    p95Ms: Math.round(sorted[Math.ceil(sorted.length * 0.95) - 1]),
    maxMs: Math.round(sorted.at(-1)),
  };
}

await healthy();
const courses = await preparedCourses();
const visitors = [];
try {
  for (let start = 0; start < courses.length; start += 10) {
    const batch = await all(
      "Get session cookies",
      courses.slice(start, start + 10).map(visitor),
    );
    visitors.push(...batch);
  }
  assert.equal(new Set(visitors.map(({ cookie }) => cookie)).size, expected);
  const started = performance.now();
  const joins = await all(
    "Simultaneous joins",
    visitors.map(async (visitor, i) => {
      const role = visitor.roles[i % visitor.roles.length];
      const result = await request("/api/evaluation/session", {
        cookie: visitor.cookie,
        status: 201,
        body: { role, course: courses[i], acknowledged: true },
      });
      assert.equal(result.json.role, role);
      assert.equal(result.json.course, courses[i]);
      return result;
    }),
  );
  assert.equal(new Set(joins.map(({ json }) => json.projectId)).size, expected);
  console.log(
    JSON.stringify({
      joined: joins.length,
      elapsedMs: Math.round(performance.now() - started),
      ...timings(joins.map(({ elapsed }) => elapsed)),
    }),
  );

  const overflow = await visitor();
  visitors.push(overflow);
  await request("/api/evaluation/session", {
    cookie: overflow.cookie,
    status: 429,
    body: { role: "student", course: courses[0], acknowledged: true },
  });
  console.log(`Session ${expected + 1} rejected at the configured cap`);

  for (let round = 1; round <= 3; round++) {
    const checks = await all(
      `Activity round ${round}`,
      joins.map(async ({ json }, i) => {
        const { cookie } = visitors[i];
        const profile = await request("/api/auth/me", { cookie });
        const projects = await request("/api/research", { cookie });
        assert.ok(
          projects.json.projects.some(({ id }) => id === json.projectId),
        );
        const endpoints = {
          student: "/api/evaluation/revision",
          professor: "/api/evaluation/request-letter",
          adviser: "/api/consultations",
          panelist: `/api/defense-sessions/${json.defenseId}/structured-evaluation`,
          dean: "/api/dean/dashboard",
        };
        const pdf = ["student", "professor"].includes(json.role);
        const activity = await request(endpoints[json.role], { cookie, pdf });
        return {
          userId: profile.json.user.id,
          pdf,
          times: [profile.elapsed, projects.elapsed, activity.elapsed],
        };
      }),
    );
    assert.equal(new Set(checks.map(({ userId }) => userId)).size, expected);
    await healthy();
    console.log(
      JSON.stringify({
        round,
        sessions: checks.length,
        requests: checks.length * 3,
        pdfs: checks.filter(({ pdf }) => pdf).length,
        ...timings(checks.flatMap(({ times }) => times)),
      }),
    );
  }
} finally {
  let closed = 0;
  const failures = [];
  for (let offset = 0; offset < visitors.length; offset += 5) {
    const results = await Promise.allSettled(
      visitors.slice(offset, offset + 5).map(async ({ cookie }) => {
        const session = await fetch(
          new URL("/api/evaluation/session", origin),
          {
            headers: { Cookie: cookie },
            signal: AbortSignal.timeout(15_000),
          },
        );
        await session.body?.cancel();
        if (session.status === 401) return false;
        assert.equal(session.status, 200);
        await request("/api/evaluation/end", { cookie, method: "POST" });
        await request("/api/evaluation/session", { cookie, status: 401 });
        return true;
      }),
    );
    closed += results.filter(
      (result) => result.status === "fulfilled" && result.value,
    ).length;
    failures.push(...results.filter(({ status }) => status === "rejected"));
  }
  console.log(JSON.stringify({ closed, cleanupFailures: failures.length }));
  if (failures.length) process.exitCode = 1;
  await healthy();
}
