import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const base = "http://127.0.0.1:10000";
const origin = "https://evaluation.example.org";
const run = promisify(execFile);
async function ready() {
  for (let attempt = 0; attempt < 90; attempt++) {
    try {
      const response = await fetch(`${base}/api/health`);
      if (response.ok) {
        assert.deepEqual(await response.json(), {
          status: "ok",
          mode: "evaluation",
          database: "connected",
        });
        return;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("Evaluation container did not become healthy.");
}
await ready();
const page = await fetch(`${base}/evaluate`);
assert.equal(page.status, 200);
assert.match(await page.text(), /<html/i);
const configResponse = await fetch(`${base}/api/evaluation/config`);
const cookie = configResponse.headers.get("set-cookie")?.split(";")[0];
assert.ok(cookie?.startsWith("advisio_evaluation="));
const config = await configResponse.json();
assert.equal(config.entryUrl, `${origin}/evaluate`);
assert.equal(config.temporaryStorage, true);
assert.equal(config.roles.length, 5);
assert.equal(config.courses.length, 7);
const headers = { cookie, origin, "Content-Type": "application/json" };
async function begin() {
  const response = await fetch(`${base}/api/evaluation/session`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      role: "student",
      course: "BSIT",
      acknowledged: true,
    }),
  });
  assert.equal(response.status, 201);
  return response.json();
}
const initial = await begin();
const survey = new URL(initial.surveyUrl);
assert.equal(
  survey.searchParams.get("entry.1428349663"),
  "Researchers/Students",
);
assert.equal(
  survey.searchParams.get("entry.874351903"),
  "Information Technology",
);
assert.equal((await fetch(`${base}/api/auth/me`, { headers })).status, 200);
const classesResponse = await fetch(`${base}/api/class-records/mine`, {
  headers,
});
assert.equal(classesResponse.status, 200);
const classes = (await classesResponse.json()).classes;
assert.equal(classes.length, 1);
assert.equal(classes[0].ready, true);
const gradesResponse = await fetch(
  `${base}/api/class-records/${classes[0].id}/mine`,
  { headers },
);
assert.equal(gradesResponse.status, 200);
const grades = await gradesResponse.json();
const prelim = grades.periods.find((period) => period.code === "PRELIM").release
  .snapshot;
assert.equal(prelim.entries.length, 3);
assert.equal(prelim.attendance.length, 3);
assert.equal(prelim.calculation.complete, true);
assert.ok(prelim.calculation.score > 0 && prelim.calculation.score <= 100);
assert.equal(grades.overall, null);
assert.equal(
  (await fetch(`${base}/api/class-records/${classes[0].id}`, { headers }))
    .status,
  403,
);
const consultationsResponse = await fetch(`${base}/api/consultations`, {
  headers,
});
assert.equal(consultationsResponse.status, 200);
const consultations = (await consultationsResponse.json()).consultations;
const completed = consultations.find(
  (consultation) => consultation.status === "completed",
);
assert.ok(completed?.notes);
assert.equal(completed.actionItems.length, 3);
const manuscript = await fetch(`${base}/api/evaluation/revision`, { headers });
assert.equal(manuscript.status, 200);
assert.equal(
  Buffer.from(await manuscript.arrayBuffer())
    .subarray(0, 5)
    .toString(),
  "%PDF-",
);
const crossOrigin = await fetch(`${base}/api/evaluation/session`, {
  method: "POST",
  headers: { ...headers, origin: "https://other.example.org" },
  body: JSON.stringify({ role: "student", course: "BSIT", acknowledged: true }),
});
assert.equal(crossOrigin.status, 403);
await run("docker", ["restart", "advisio-evaluation-check"]);
await ready();
assert.equal(
  (await fetch(`${base}/api/evaluation/session`, { headers })).status,
  401,
);
assert.equal((await fetch(`${base}/api/auth/me`, { headers })).status, 401);
const restarted = await begin();
assert.notEqual(restarted.projectId, initial.projectId);
assert.equal(
  (await fetch(`${base}/api/evaluation/revision`, { headers })).status,
  200,
);
assert.equal(
  (await fetch(`${base}/api/evaluation/end`, { method: "POST", headers }))
    .status,
  200,
);
console.log(
  "Hosted image passed: startup, first-party session, released class grades and attendance, consultation history, native portal, PDF, Form handoff, origin checks, and free-host restart recovery.",
);
