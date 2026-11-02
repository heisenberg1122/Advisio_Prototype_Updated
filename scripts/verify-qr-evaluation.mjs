import assert from "node:assert/strict";
import fs from "node:fs/promises";
import dotenv from "dotenv";
import pg from "pg";

const origin = "http://localhost:3100";
const base = "http://127.0.0.1:5100";
const env = dotenv.parse(
  await fs.readFile(new URL("../.env.evaluation.local", import.meta.url)),
);
const url = new URL(env.EVALUATION_DATABASE_URL);
assert.equal(url.pathname, "/advisio_evaluation");
assert.equal(url.hostname, "127.0.0.1");
assert.equal(url.port, "5436");
const pool = new pg.Pool({ connectionString: url.toString() });
const cookies = new Set();
async function request(
  endpoint,
  { cookie, method = "GET", body, headers = {} } = {},
) {
  const form = body instanceof FormData;
  const response = await fetch(`${base}${endpoint}`, {
    method,
    headers: {
      Origin: origin,
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body && !form ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    ...(body ? { body: form ? body : JSON.stringify(body) } : {}),
  });
  const type = response.headers.get("content-type") || "";
  const data = type.includes("json")
    ? await response.json()
    : Buffer.from(await response.arrayBuffer());
  return { status: response.status, data, response };
}
async function begin(role, course) {
  const entry = await request("/api/evaluation/config");
  assert.equal(entry.status, 200);
  const cookie = entry.response.headers.get("set-cookie").split(";")[0];
  cookies.add(cookie);
  const active = await request("/api/evaluation/session", {
    cookie,
    method: "POST",
    body: { role, course, acknowledged: true },
  });
  assert.equal(active.status, 201, JSON.stringify(active.data));
  return { cookie, session: active.data };
}
async function end(cookie) {
  const result = await request("/api/evaluation/end", {
    cookie,
    method: "POST",
  });
  assert.equal(result.status, 200);
  cookies.delete(cookie);
}
async function nativeAction(cookie, session, revision) {
  const hash = (await import("node:crypto"))
    .createHash("sha256")
    .update(cookie.split("=")[1])
    .digest("hex");
  const {
    rows: [record],
  } = await pool.query(
    "SELECT id FROM public.advisio_evaluation_sessions WHERE token_hash=$1",
    [hash],
  );
  assert.match(record.id, /^[a-f0-9]{32}$/);
  const schema = `"eval_${record.id}"`;
  if (session.role === "professor" || session.role === "dean") {
    const {
      rows: [groups],
    } = await pool.query(
      `SELECT count(DISTINCT user_id)::int AS total FROM ${schema}.research_members WHERE "projectRole"='LEADER' `,
    );
    assert.equal(
      groups.total,
      3,
      "Faculty scenarios need three distinct research-group leaders.",
    );
  }
  const {
    rows: [submission],
  } = await pool.query(
    `SELECT s.id,s.task_id,s.document_id,s.document_version_id FROM ${schema}.task_submissions s JOIN ${schema}.workflow_tasks t ON t.id=s.task_id WHERE s.research_id=$1 AND t.title='Revised research proposal'`,
    [session.projectId],
  );
  if (session.role === "student") {
    const form = new FormData();
    form.set(
      "file",
      new Blob([revision], { type: "application/pdf" }),
      session.revisionName,
    );
    form.set("researchId", session.projectId);
    form.set("title", "Revised research proposal");
    form.set("idempotencyKey", "evaluation-verification-revision");
    const upload = await request(
      `/api/workflows/tasks/${submission.task_id}/submissions/upload`,
      { cookie, method: "POST", body: form },
    );
    assert.equal(upload.status, 201, JSON.stringify(upload.data));
    const {
      rows: [version],
    } = await pool.query(
      `SELECT v.file_name,s.status FROM ${schema}.task_submissions s JOIN ${schema}.document_versions v ON v.id=s.document_version_id WHERE s.id=$1`,
      [submission.id],
    );
    assert.equal(version.file_name, session.revisionName);
    assert.equal(version.status, "UNDER_REVIEW");
  } else if (session.role === "professor") {
    const result = await request(
      `/api/workflows/tasks/submissions/${submission.id}/review`,
      {
        cookie,
        method: "PATCH",
        body: {
          status: "REVISION_REQUIRED",
          reviewNote: "The revised scope and method are now being reviewed.",
        },
      },
    );
    assert.equal(result.status, 200, JSON.stringify(result.data));
  } else if (session.role === "adviser" || session.role === "dean") {
    const review = await request(
      `/api/documents/versions/${submission.document_version_id}/reviews`,
      {
        cookie,
        method: "POST",
        body: {
          reviewType: session.role === "dean" ? "DEAN" : "ADVISER",
          overallComment:
            "Clarify the scope and keep the proposed outputs aligned with the method.",
          recommendation: "MINOR_REVISION",
        },
      },
    );
    assert.equal(review.status, 201, JSON.stringify(review.data));
    if (session.role === "adviser") {
      const list = await request("/api/consultations", { cookie });
      assert.equal(list.status, 200);
      const pending = list.data.consultations.find(
        (c) => c.status === "requested",
      );
      assert.ok(pending);
      const approve = await request(
        `/api/consultations/${pending.id}/approve`,
        { cookie, method: "PATCH", body: {} },
      );
      assert.equal(approve.status, 200, JSON.stringify(approve.data));
    } else {
      const dashboard = await request("/api/dean/dashboard", { cookie });
      assert.equal(dashboard.status, 200, JSON.stringify(dashboard.data));
      assert.equal(dashboard.data.projects.length, 3);
    }
  } else {
    const endpoint = `/api/defense-sessions/${session.defenseId}/structured-evaluation`;
    const form = await request(endpoint, { cookie });
    assert.equal(form.status, 200, JSON.stringify(form.data));
    assert.equal(form.data.evaluation, null);
    const snapshot = form.data.snapshot;
    const answers = {
      researchers: Object.fromEntries(
        snapshot.roster.map((r) => [
          r.userId,
          Object.fromEntries(snapshot.spec.presentation.map((c) => [c.id, 3])),
        ]),
      ),
      manuscript: Object.fromEntries(
        snapshot.spec.manuscript.map((c) => [c.id, 3]),
      ),
      recommendation: "APPROVED_WITH_MINOR_REVISIONS",
      feedback:
        "Clarify the proposed assumptions and complete the documented revision checklist.",
      signature: "",
    };
    const save = await request(endpoint, {
      cookie,
      method: "PUT",
      body: { revision: 0, answers },
    });
    assert.equal(save.status, 200, JSON.stringify(save.data));
    const preview = await request(`${endpoint}/preview`, {
      cookie,
      method: "POST",
      body: { revision: 1 },
    });
    assert.equal(preview.status, 200, JSON.stringify(preview.data));
    assert.match(preview.data.evaluation.previewHash, /^[a-f0-9]{64}$/);
    const submit = await request(`${endpoint}/submit`, {
      cookie,
      method: "POST",
      body: {
        revision: 1,
        previewHash: preview.data.evaluation.previewHash,
        confirmed: true,
      },
    });
    assert.equal(submit.status, 200, JSON.stringify(submit.data));
    assert.ok(submit.data.evaluation.lockedAt);
  }
}
try {
  assert.equal((await request("/api/health")).data.mode, "evaluation");
  assert.equal((await request("/api/research")).status, 401);
  assert.equal(
    (
      await request("/api/evaluation/session", {
        method: "POST",
        headers: { Origin: "https://untrusted.invalid" },
        body: { role: "student", course: "BSIT", acknowledged: true },
      })
    ).status,
    403,
  );
  const config = (await request("/api/evaluation/config")).data;
  assert.equal(config.roles.length, 5);
  assert.equal(config.courses.length, 7);
  assert.equal(
    (await request("/api/evaluation/qr")).data.subarray(1, 4).toString(),
    "PNG",
  );
  let combinations = 0;
  const selected = process.argv
    .find((value) => value.startsWith("--course="))
    ?.split("=")[1];
  for (const course of config.courses.filter(
    (c) => !selected || c.id === selected,
  ))
    for (const role of config.roles) {
      const { cookie, session } = await begin(role.id, course.id);
      assert.equal(session.course, course.id);
      assert.equal(session.role, role.id);
      assert.equal(session.tasks.length, 6);
      const profile = await request("/api/auth/me", { cookie });
      assert.equal(profile.status, 200, JSON.stringify(profile.data));
      assert.equal(profile.data.user.roles.length, 1);
      assert.equal(profile.data.user.program.code, course.id);
      const resumed = await request("/api/evaluation/session", { cookie });
      assert.equal(resumed.data.projectId, session.projectId);
      const double = await request("/api/evaluation/session", {
        cookie,
        method: "POST",
        body: { role: role.id, course: course.id, acknowledged: true },
      });
      assert.equal(double.data.projectId, session.projectId);
      assert.equal((await request("/api/users", { cookie })).status, 403);
      assert.equal(
        (
          await request("/api/auth/active-college", {
            cookie,
            method: "POST",
            body: { collegeId: "other" },
          })
        ).status,
        403,
      );
      const revision = await request("/api/evaluation/revision", { cookie });
      assert.equal(revision.status, 200);
      assert.equal(revision.data.subarray(0, 4).toString(), "%PDF");
      const projects = await request("/api/research", { cookie });
      assert.equal(projects.status, 200, JSON.stringify(projects.data));
      if (role.id === "panelist") assert.ok(session.defenseId);
      await nativeAction(cookie, session, revision.data);
      await end(cookie);
      assert.equal((await request("/api/auth/me", { cookie })).status, 401);
      combinations++;
      console.log(`Passed ${course.label}: ${role.label}`);
    }
  const a = await begin("student", "BSIT");
  const b = await begin("student", "BSIT");
  assert.notEqual(a.session.projectId, b.session.projectId);
  assert.equal(
    (
      await request(`/api/research/${a.session.projectId}`, {
        cookie: b.cookie,
      })
    ).status,
    404,
  );
  const before = await request("/api/notifications?inbox=researcher", {
    cookie: b.cookie,
  });
  assert.equal(before.status, 200);
  await end(a.cookie);
  assert.equal(
    (await request("/api/auth/me", { cookie: b.cookie })).status,
    200,
  );
  const rawToken = b.cookie.split("=")[1];
  const hash = (await import("node:crypto"))
    .createHash("sha256")
    .update(rawToken)
    .digest("hex");
  await pool.query(
    "UPDATE public.advisio_evaluation_sessions SET touched_at=now()-interval '21 minutes' WHERE token_hash=$1",
    [hash],
  );
  assert.equal(
    (await request("/api/auth/me", { cookie: b.cookie })).status,
    401,
  );
  cookies.delete(b.cookie);
  if (process.argv.includes("--capacity")) {
    const started = Date.now();
    const wave = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        begin(config.roles[i % 5].id, config.courses[i % 7].id),
      ),
    );
    assert.equal(new Set(wave.map((x) => x.session.projectId)).size, 20);
    const extra = await request("/api/evaluation/config");
    const overflow = await request("/api/evaluation/session", {
      cookie: extra.response.headers.get("set-cookie").split(";")[0],
      method: "POST",
      body: { role: "student", course: "BSIT", acknowledged: true },
    });
    assert.equal(overflow.status, 429);
    await Promise.all(
      wave.map(async ({ cookie, session }) => {
        const revision = await request("/api/evaluation/revision", { cookie });
        assert.equal(revision.status, 200);
        await nativeAction(cookie, session, revision.data);
      }),
    );
    await Promise.all(wave.map((x) => end(x.cookie)));
    console.log(
      `PASS: 20 simultaneous private workspaces completed native activities; a 21st was refused; ${((Date.now() - started) / 1000).toFixed(1)} seconds on this computer.`,
    );
  }
  console.log(
    `PASS: ${combinations} native role/course sessions and mutations; revision upload; professor review; adviser review/consultation approval; Dean review/overview; panel save/preview/submit; resume; repeated begin; cross-workspace isolation; end/replay; idle expiry; origin boundary; QR; PDF access.`,
  );
} finally {
  for (const cookie of cookies)
    await request("/api/evaluation/end", { cookie, method: "POST" }).catch(
      () => {},
    );
  await pool.end();
}
