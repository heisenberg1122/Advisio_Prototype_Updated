import assert from "node:assert/strict";
import { setTimeout as wait } from "node:timers/promises";
import fs from "node:fs/promises";

const origin = new URL(process.argv[2]);
const expected = Number(process.argv[3] || 50);
const expectedCommit = process.argv[4];
let bootId;
let cap;
assert.ok(Number.isInteger(expected) && expected >= 1 && expected <= 50);
assert.ok(
  origin.origin === "https://advisio-tam-evaluation-2026.onrender.com" ||
    (origin.protocol === "http:" && origin.hostname === "127.0.0.1"),
  "Use the dedicated ADVISIO evaluation or a local disposable instance.",
);

function verifyInstance(response) {
  const current = response.headers.get("X-Advisio-Evaluation-Boot");
  const commit = response.headers.get("X-Advisio-Evaluation-Commit");
  assert.ok(current, "No evaluation instance ID was returned.");
  if (expectedCommit) assert.equal(commit, expectedCommit, "Unexpected deployed commit.");
  if (bootId) assert.equal(current, bootId, "The evaluation instance changed during the rehearsal.");
  else {
    bootId = current;
    console.log(JSON.stringify({ startedAt: new Date().toISOString(), bootId, commit }));
  }
}

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
  }).catch((error) => {
    throw new Error(`${method} ${endpoint}: ${error.message}`, { cause: error });
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
  verifyInstance(response);
  if (pdf) assert.equal(raw.subarray(0, 5).toString(), "%PDF-");
  const serverTiming = response.headers.get("server-timing") || "";
  return {
    json,
    cookie: response.headers.getSetCookie()[0]?.split(";")[0],
    elapsed: performance.now() - started,
    acquireMs: Number(serverTiming.match(/evaluation-acquire;dur=([\d.]+)/)?.[1]),
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
    cap = json.maxActive;
    assert.ok(cap >= expected, "The configured session cap is too low.");
    assert.equal(
      json.active,
      0,
      "Wait until respondents finish before the rehearsal.",
    );
    const target = json.courses.reduce((sum, course) => sum + course.target, 0);
    assert.ok(target >= expected, "The configured workspace pool is too small.");
    const ready = json.courses.reduce((sum, course) => sum + course.ready, 0);
    if (ready !== previous)
      console.log(`Prepared ${ready}/${target} workspaces`);
    previous = ready;
    if (json.courses.every((course) => course.ready === course.target)) {
      const courses = [];
      for (let slot = 0; courses.length < expected; slot++) {
        for (const { course, ready } of json.courses) {
          if (slot < ready) courses.push(course);
        }
      }
      return courses.slice(0, expected);
    }
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
  if (!values.length) return null;
  const sorted = values.toSorted((a, b) => a - b);
  return {
    p95Ms: Math.round(sorted[Math.ceil(sorted.length * 0.95) - 1]),
    maxMs: Math.round(sorted.at(-1)),
  };
}

await healthy();
const courses = await preparedCourses();
const visitors = [];
const streams = [];
const recoveryFile = new URL(
  "../.evaluation/capacity-rehearsal-sessions.json",
  import.meta.url,
);
try {
  for (let start = 0; start < courses.length; start += 10) {
    const batch = await all(
      "Get session cookies",
      courses.slice(start, start + 10).map(visitor),
    );
    visitors.push(...batch);
    await fs.mkdir(new URL("../.evaluation/", import.meta.url), {
      recursive: true,
    });
    await fs.writeFile(
      recoveryFile,
      JSON.stringify(visitors.map(({ cookie }) => cookie)),
      { mode: 0o600 },
    );
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

  if (cap === expected) {
    const overflow = await visitor();
    visitors.push(overflow);
    await request("/api/evaluation/session", {
      cookie: overflow.cookie,
      status: 429,
      body: { role: "student", course: courses[0], acknowledged: true },
    });
    console.log(`Session ${expected + 1} rejected at the configured cap`);
  }

  await all(
    "Live event streams",
    joins.map(async (_session, i) => {
      const controller = new AbortController();
      streams.push(controller);
      const deadline = setTimeout(() => controller.abort(), 35_000);
      const response = await fetch(new URL("/api/realtime/events", origin), {
        headers: { Cookie: visitors[i].cookie },
        signal: controller.signal,
      }).finally(() => clearTimeout(deadline));
      assert.equal(response.status, 200);
      verifyInstance(response);
      assert.match(
        response.headers.get("content-type") || "",
        /text\/event-stream/,
      );
    }),
  );
  console.log(`Opened ${streams.length} simultaneous live event streams`);

  const writes = await all(
    "Simultaneous preference saves",
    joins.map(async (_session, i) => {
      const preference = i % 2 ? "DARK" : "LIGHT";
      const result = await request("/api/auth/me/appearance", {
        cookie: visitors[i].cookie,
        method: "PATCH",
        body: { appearancePreference: preference },
      });
      assert.equal(result.json.appearancePreference, preference);
      return result.elapsed;
    }),
  );
  console.log(JSON.stringify({ saved: writes.length, ...timings(writes) }));

  for (let round = 1; round <= 3; round++) {
    const checks = await all(
      `Activity round ${round}`,
      joins.map(async ({ json }, i) => {
        const { cookie } = visitors[i];
        const profile = await request("/api/auth/me", { cookie });
        assert.equal(
          profile.json.user.appearancePreference,
          i % 2 ? "DARK" : "LIGHT",
        );
        const projects = await request("/api/research", { cookie });
        assert.ok(
          projects.json.projects.some(({ id }) => id === json.projectId),
        );
        assert.ok(!projects.json.projects.some(({ id }) =>
          id !== json.projectId && joins.some((other) => other.json.projectId === id),
        ), "Another participant's project was returned.");
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
          acquireMs: [profile.acquireMs, projects.acquireMs, activity.acquireMs].filter(Number.isFinite),
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
        profile: timings(checks.map(({ times }) => times[0])),
        projects: timings(checks.map(({ times }) => times[1])),
        pdf: timings(checks.filter(({ pdf }) => pdf).map(({ times }) => times[2])),
        roleActivity: timings(checks.filter(({ pdf }) => !pdf).map(({ times }) => times[2])),
        databaseSlotAndValidation: timings(checks.flatMap(({ acquireMs }) => acquireMs)),
      }),
    );
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  for (const stream of streams) stream.abort();
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
  try {
    await healthy();
    if (!failures.length) await fs.rm(recoveryFile, { force: true });
  } catch (error) {
    console.error(`Post-test health failed: ${error.message}`);
    process.exitCode = 1;
  }
}
