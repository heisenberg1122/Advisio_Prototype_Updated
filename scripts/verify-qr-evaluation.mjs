import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import dotenv from "dotenv";
import pg from "pg";
import { PDFDocument } from "pdf-lib";

const origin = process.env.EVALUATION_TEST_ORIGIN || "http://localhost:3100";
const base = process.env.EVALUATION_TEST_API || "http://127.0.0.1:5100";
const env = dotenv.parse(
  await fs.readFile(new URL("../.env.evaluation.local", import.meta.url)),
);
const url = new URL(env.EVALUATION_DATABASE_URL);
assert.equal(url.pathname, "/advisio_evaluation");
assert.equal(url.hostname, "127.0.0.1");
assert.equal(url.port, "5436");
const pool = new pg.Pool({ connectionString: url.toString() });
const cookies = new Set();
const expected = {
  student: ["B"],
  professor: ["A", "B", "C"],
  adviser: ["A", "B"],
  panelist: ["C", "D"],
  dean: ["A", "B", "C"],
};
async function request(
  endpoint,
  { cookie, method = "GET", body, headers = {} } = {},
) {
  const form = body instanceof FormData;
  const response = await fetch(base + endpoint, {
    method,
    headers: {
      Origin: origin,
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body && !form ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    ...(body ? { body: form ? body : JSON.stringify(body) } : {}),
  });
  const data = (response.headers.get("content-type") || "").includes("json")
    ? await response.json()
    : Buffer.from(await response.arrayBuffer());
  return { status: response.status, data, response };
}
function ok(result, status = 200) {
  assert.equal(result.status, status, JSON.stringify(result.data));
  return result.data;
}
async function begin(role, course) {
  const entry = await request("/api/evaluation/config");
  ok(entry);
  const cookie = entry.response.headers.get("set-cookie").split(";")[0];
  cookies.add(cookie);
  const active = await request("/api/evaluation/session", {
    cookie,
    method: "POST",
    body: { role, course, acknowledged: true },
  });
  return { cookie, session: ok(active, 201) };
}
async function switchRole(workspace, role) {
  const previous = workspace.cookie;
  const result = await request("/api/evaluation/switch-role", {
    cookie: previous,
    method: "POST",
    body: { role },
  });
  const session = ok(result);
  workspace.cookie = result.response.headers.get("set-cookie").split(";")[0];
  cookies.delete(previous);
  cookies.add(workspace.cookie);
  assert.notEqual(
    workspace.cookie,
    previous,
    "Switching rotates the session cookie.",
  );
  assert.equal(
    (await request("/api/auth/me", { cookie: previous })).status,
    401,
    "Old role cookies cannot be replayed.",
  );
  assert.equal(
    session.expiresAt,
    workspace.session.expiresAt,
    "Switching cannot extend absolute lifetime.",
  );
  assert.equal(session.course, workspace.session.course);
  workspace.session = session;
}
async function end(workspace) {
  ok(
    await request("/api/evaluation/end", {
      cookie: workspace.cookie,
      method: "POST",
    }),
  );
  assert.equal(
    (await request("/api/auth/me", { cookie: workspace.cookie })).status,
    401,
  );
  cookies.delete(workspace.cookie);
}
async function registry(workspace) {
  const hash = createHash("sha256")
    .update(workspace.cookie.split("=")[1])
    .digest("hex");
  const {
    rows: [row],
  } = await pool.query(
    "SELECT * FROM public.advisio_evaluation_sessions WHERE token_hash=$1",
    [hash],
  );
  assert.match(row.id, /^[a-f0-9]{32}$/);
  return { row, schema: `"eval_${row.id}"` };
}
async function verifyRole(workspace, collegeCode) {
  const { cookie, session } = workspace;
  const role = session.role;
  const profile = ok(await request("/api/auth/me", { cookie })).user;
  assert.equal(
    profile.roles.length,
    1,
    "Each switched identity has one native role.",
  );
  assert.equal(profile.college.code, collegeCode);
  const projects = ok(await request("/api/research", { cookie })).projects;
  assert.deepEqual(
    projects.map((p) => p.groupName.slice(-1)).sort(),
    expected[role],
  );
  assert.equal(
    session.title,
    projects.find((p) => p.id === session.projectId).title,
  );
  for (const project of projects) {
    assert.equal(project.college.code, collegeCode);
    const stages = project.workflowInstance.workflow.stages;
    assert.equal(stages.length, 10);
    const target = { A: 4, B: 3, C: 5, D: 6 }[project.groupName.slice(-1)];
    assert.equal(project.workflowInstance.currentStage.sequence, target);
    if (["student", "adviser", "professor"].includes(role)) {
      const progress = ok(
        await request(`/api/research/${project.id}/manuscript-workflow`, {
          cookie,
        }),
      ).milestones;
      assert.equal(progress.filter((m) => m.completed).length, target - 1);
      assert.equal(progress.find((m) => m.isCurrent).sequence, target);
      assert.ok(
        progress.filter((m) => m.sequence > target).every((m) => m.isBlocked),
        "Later milestones remain locked.",
      );
    }
  }
  assert.equal(session.tasks.length, 6);
  assert.equal(session.roles.length, 5);
  assert.equal((await request("/api/users", { cookie })).status, 403);
  assert.equal(
    (await request("/api/signatures", { cookie, method: "POST", body: {} }))
      .status,
    403,
  );
  const { row, schema } = await registry(workspace);
  for (const [name, account] of Object.entries(row.accounts)) {
    if (name === role) continue;
    for (const projectId of account.projectIds.filter(
      (id) => !row.accounts[role].projectIds.includes(id),
    )) {
      assert.equal(
        (await request(`/api/research/${projectId}`, { cookie })).status,
        404,
        "Direct access must honor the role matrix.",
      );
    }
  }
  if (role === "student" || role === "professor") {
    const student = role === "student";
    const classes = ok(
      await request(`/api/class-records${student ? "/mine" : ""}`, { cookie }),
    ).classes;
    assert.equal(classes.length, 1);
    const grades = ok(
      await request(
        `/api/class-records/${classes[0].id}${student ? "/mine" : ""}`,
        { cookie },
      ),
    );
    const prelim = grades.periods.find((p) => p.code === "PRELIM");
    if (student) {
      assert.equal(prelim.release.snapshot.entries.length, 3);
      assert.equal(prelim.release.snapshot.attendance.length, 3);
      assert.equal(grades.overall, null);
      assert.equal(
        grades.periods.find((p) => p.code === "FINALS").release,
        null,
      );
    } else
      assert.ok(
        prelim.rows.every((row) => row.calculation.complete && row.lastRelease),
      );
  }
  if (role === "student") {
    const revision = await request("/api/evaluation/revision", { cookie });
    ok(revision);
    assert.equal((await PDFDocument.load(revision.data)).getPageCount(), 5);
    const {
      rows: [submission],
    } = await pool.query(
      `SELECT s.* FROM ${schema}.task_submissions s JOIN ${schema}.workflow_tasks t ON t.id=s.task_id JOIN ${schema}.workflow_stages m ON m.id=t.stage_id WHERE s.research_id=$1 AND m.sequence=3`,
      [session.projectId],
    );
    assert.equal(submission.status, "REVISION_REQUIRED");
    const form = new FormData();
    form.set(
      "file",
      new Blob([revision.data], { type: "application/pdf" }),
      session.revisionName,
    );
    form.set("researchId", session.projectId);
    form.set("title", "Prepared research revision");
    form.set("idempotencyKey", randomUUID());
    ok(
      await request(
        `/api/workflows/tasks/${submission.task_id}/submissions/upload`,
        { cookie, method: "POST", body: form },
      ),
      201,
    );
    const {
      rows: [saved],
    } = await pool.query(
      `SELECT status FROM ${schema}.task_submissions WHERE id=$1`,
      [submission.id],
    );
    assert.equal(saved.status, "UNDER_REVIEW");
    const history = ok(
      await request("/api/consultations", { cookie }),
    ).consultations;
    assert.ok(
      history.some(
        (c) => c.status === "completed" && c.actionItems.length === 3,
      ),
    );
    assert.ok(history.some((c) => c.status === "scheduled"));
  } else if (role === "adviser") {
    const {
      rows: [assignment],
    } = await pool.query(
      `SELECT * FROM ${schema}.reviewer_assignments WHERE research_id=$1 AND review_type='ADVISER' AND status='ACTIVE'`,
      [session.projectId],
    );
    ok(
      await request(
        `/api/documents/versions/${assignment.document_version_id}/reviews`,
        {
          cookie,
          method: "POST",
          body: {
            reviewType: "ADVISER",
            recommendation: "APPROVE",
            overallComment:
              "The proposed scope and method are ready for coordinator review.",
          },
        },
      ),
      201,
    );
    const consultations = ok(
      await request("/api/consultations", { cookie }),
    ).consultations;
    assert.ok(consultations.some((c) => c.status === "scheduled"));
    const pending = consultations.find((c) => c.status === "requested");
    assert.ok(pending);
    ok(
      await request(`/api/consultations/${pending.id}/approve`, {
        cookie,
        method: "PATCH",
        body: {},
      }),
    );
  } else if (role === "professor") {
    const {
      rows: [submission],
    } = await pool.query(
      `SELECT s.* FROM ${schema}.task_submissions s JOIN ${schema}.workflow_tasks t ON t.id=s.task_id JOIN ${schema}.workflow_stages m ON m.id=t.stage_id WHERE s.research_id=$1 AND m.sequence=4`,
      [session.projectId],
    );
    ok(
      await request(
        `/api/workflows/tasks/submissions/${submission.id}/review`,
        {
          cookie,
          method: "PATCH",
          body: {
            status: "REVISION_REQUIRED",
            reviewNote:
              "Record the assumptions clearly before the next milestone.",
          },
        },
      ),
    );
  } else if (role === "dean") {
    const overview = ok(await request("/api/dean/dashboard", { cookie }));
    assert.equal(overview.projects.length, 3);
    const {
      rows: [assignment],
    } = await pool.query(
      `SELECT * FROM ${schema}.reviewer_assignments WHERE research_id=$1 AND review_type='DEAN' AND status='ACTIVE'`,
      [session.projectId],
    );
    ok(
      await request(
        `/api/documents/versions/${assignment.document_version_id}/content`,
        { cookie },
      ),
    );
    ok(
      await request(
        `/api/documents/versions/${assignment.document_version_id}/reviews`,
        {
          cookie,
          method: "POST",
          body: {
            reviewType: "DEAN",
            recommendation: "APPROVE",
            overallComment:
              "Fictional defense preparation approval recorded after document review.",
          },
        },
      ),
      201,
    );
    const {
      rows: [saved],
    } = await pool.query(
      `SELECT status FROM ${schema}.reviewer_assignments WHERE id=$1`,
      [assignment.id],
    );
    assert.equal(saved.status, "COMPLETED");
  } else {
    const endpoint = `/api/defense-sessions/${session.defenseId}/structured-evaluation`;
    const form = ok(await request(endpoint, { cookie }));
    assert.equal(
      form.evaluation,
      null,
      "The respondent's current evaluation is never prefilled.",
    );
    const {
      rows: [defense],
    } = await pool.query(
      `SELECT status FROM ${schema}.defense_sessions WHERE id=$1`,
      [session.defenseId],
    );
    assert.equal(defense.status, "SCHEDULED");
    const annotations = `/api/defense-sessions/${session.defenseId}/manuscript-annotations`;
    const version = ok(await request(annotations, { cookie })).currentVersion
      .id;
    const draft = `${annotations}/${version}`;
    assert.equal(ok(await request(draft, { cookie })).review, null);
    ok(await request(draft + "/source", { cookie }));
    const marks = ["highlight", "comment", "check"].map((type, i) => ({
      id: randomUUID(),
      type,
      page: 2,
      x: 0.1,
      y: 0.2 + i * 0.1,
      width: 0.3,
      height: 0.04,
      ...(type === "comment"
        ? { text: "Clarify the evidence supporting this objective." }
        : {}),
    }));
    ok(
      await request(draft, {
        cookie,
        method: "PUT",
        body: { revision: 0, sourceVersionId: version, annotations: marks },
      }),
    );
    const preview = ok(
      await request(draft + "/preview", {
        cookie,
        method: "POST",
        body: { revision: 1 },
      }),
    );
    ok(
      await request(draft + "/share", {
        cookie,
        method: "POST",
        body: {
          revision: 1,
          previewHash: preview.previewHash,
          confirmed: true,
        },
      }),
    );
    // Use the native coordinator action rather than weakening the live-only policy.
    await switchRole(workspace, "professor");
    ok(
      await request("/api/defense-sessions/start", {
        cookie: workspace.cookie,
        method: "POST",
        body: { sessionId: session.defenseId },
      }),
    );
    await switchRole(workspace, "panelist");
    const liveCookie = workspace.cookie;
    assert.equal(
      ok(await request(draft, { cookie: liveCookie })).lastSharedRevision,
      1,
    );
    const snapshot = form.snapshot;
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
    ok(
      await request(endpoint, {
        cookie: liveCookie,
        method: "PUT",
        body: { revision: 0, answers },
      }),
    );
    const evaluationPreview = ok(
      await request(endpoint + "/preview", {
        cookie: liveCookie,
        method: "POST",
        body: { revision: 1 },
      }),
    );
    const submitted = ok(
      await request(endpoint + "/submit", {
        cookie: liveCookie,
        method: "POST",
        body: {
          revision: 1,
          previewHash: evaluationPreview.evaluation.previewHash,
          confirmed: true,
        },
      }),
    );
    assert.ok(submitted.evaluation.lockedAt);
    const { rows: history } = await pool.query(
      `SELECT status FROM ${schema}.defense_sessions WHERE status='COMPLETED'`,
    );
    assert.equal(history.length, 1);
  }
}
try {
  assert.equal(ok(await request("/api/health")).mode, "evaluation");
  assert.equal((await request("/api/research")).status, 401);
  const config = ok(await request("/api/evaluation/config"));
  assert.equal(config.roles.length, 5);
  assert.equal(config.colleges.length, 8);
  assert.equal(new Set(config.colleges.map((c) => c.collegeCode)).size, 8);
  ok(await request("/api/evaluation/qr?course=CEA&role=panelist"));
  const selected = process.argv
    .find((v) => v.startsWith("--course="))
    ?.split("=")[1];
  let count = 0;
  for (const college of (selected ? config.courses : config.colleges).filter(
    (c) => !selected || c.id === selected,
  )) {
    const workspace = await begin(
      "student",
      selected ? college.id : college.collegeCode,
    );
    const original = await registry(workspace);
    assert.equal(Object.keys(original.row.accounts).length, 5);
    assert.equal(
      (
        await request("/api/evaluation/switch-role", {
          cookie: workspace.cookie,
          method: "POST",
          body: { role: "SYSTEM_ADMIN" },
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await request("/api/evaluation/switch-role", {
          cookie: workspace.cookie,
          method: "POST",
          body: { role: "dean", college: "other" },
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await request("/api/evaluation/switch-role", {
          cookie: workspace.cookie,
          method: "POST",
          headers: { Origin: "https://untrusted.invalid" },
          body: { role: "dean" },
        })
      ).status,
      403,
    );
    // Verify the same database and storage survive all five native identities.
    for (const role of [
      "student",
      "adviser",
      "professor",
      "dean",
      "panelist",
    ]) {
      if (workspace.session.role !== role) await switchRole(workspace, role);
      assert.equal((await registry(workspace)).row.id, original.row.id);
      await verifyRole(workspace, college.collegeCode);
      count++;
      console.log(`Passed ${college.collegeCode}: ${role}`);
    }
    await switchRole(workspace, "professor");
    const overview = ok(
      await request("/api/research", { cookie: workspace.cookie }),
    ).projects;
    const c = overview.find((p) => p.groupName.endsWith("C"));
    const {
      rows: [deanReview],
    } = await pool.query(
      `SELECT r.status FROM ${original.schema}.reviewer_assignments r WHERE research_id=$1 AND review_type='DEAN'`,
      [c.id],
    );
    assert.equal(
      deanReview.status,
      "COMPLETED",
      "Dean approval persists when returning to the coordinator.",
    );
    await end(workspace);
    const {
      rows: [cleaned],
    } = await pool.query(
      "SELECT cleaned_at FROM public.advisio_evaluation_sessions WHERE id=$1",
      [original.row.id],
    );
    assert.ok(cleaned.cleaned_at);
  }
  const a = await begin("student", "BSIT"),
    b = await begin("student", "BSA");
  assert.notEqual(a.session.projectId, b.session.projectId);
  assert.equal(
    (
      await request(`/api/research/${a.session.projectId}`, {
        cookie: b.cookie,
      })
    ).status,
    404,
  );
  await end(a);
  assert.equal(
    (await request("/api/auth/me", { cookie: b.cookie })).status,
    200,
  );
  const bRow = await registry(b);
  await pool.query(
    "UPDATE public.advisio_evaluation_sessions SET touched_at=now()-interval '21 minutes' WHERE id=$1",
    [bRow.row.id],
  );
  assert.equal(
    (
      await request("/api/evaluation/switch-role", {
        cookie: b.cookie,
        method: "POST",
        body: { role: "dean" },
      })
    ).status,
    401,
  );
  cookies.delete(b.cookie);
  const absolute = await begin("dean", "BSA");
  const absoluteRow = await registry(absolute);
  await pool.query(
    "UPDATE public.advisio_evaluation_sessions SET created_at=now()-interval '61 minutes',touched_at=now() WHERE id=$1",
    [absoluteRow.row.id],
  );
  assert.equal(
    (
      await request("/api/evaluation/switch-role", {
        cookie: absolute.cookie,
        method: "POST",
        body: { role: "student" },
      })
    ).status,
    401,
  );
  cookies.delete(absolute.cookie);
  if (process.argv.includes("--capacity")) {
    const wave = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        begin(config.roles[i % 5].id, config.colleges[i % 8].id),
      ),
    );
    assert.equal(new Set(wave.map((w) => w.session.projectId)).size, 20);
    const extra = await request("/api/evaluation/config");
    assert.equal(
      (
        await request("/api/evaluation/session", {
          cookie: extra.response.headers.get("set-cookie").split(";")[0],
          method: "POST",
          body: { role: "student", course: "BSIT", acknowledged: true },
        })
      ).status,
      429,
    );
    await Promise.all(wave.map(end));
    console.log(
      "PASS: 20 concurrent isolated workspaces; session 21 rejected; cleanup completed.",
    );
  }
  console.log(
    `PASS: ${count} college-role experiences; native upload, reviews, consultations, class records, Dean approval, annotations/save/preview/share, live evaluation; role and tenant boundaries; cookie rotation; unchanged lifetime; cleanup and idle expiry.`,
  );
} finally {
  for (const cookie of cookies)
    await request("/api/evaluation/end", { cookie, method: "POST" }).catch(
      () => {},
    );
  await pool.end();
}
