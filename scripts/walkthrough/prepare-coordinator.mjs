import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { root, readJson, writeJson } from "./common.mjs";

const file = path.join(root, ".walkthrough/coordinator/demo.json");
const demo = await readJson(file);
if (demo.url !== "http://localhost:3300" || !/^walkthrough_coordinator_[a-f0-9]{16}$/.test(demo.schema)) throw new Error("Only the isolated coordinator fixture may be prepared.");
if (demo.prepared) { console.log("Coordinator fixture already prepared; preserving its recorded state."); process.exit(0); }
const tokens = {};
async function request(actor, route, body, method = body === undefined ? "GET" : "POST", expect) {
  const response = await fetch(demo.url + route, { method, headers: { ...(tokens[actor] ? { Authorization: `Bearer ${tokens[actor]}` } : {}), ...(body instanceof FormData ? {} : body === undefined ? {} : { "Content-Type": "application/json" }) }, body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body), signal: AbortSignal.timeout(60000) });
  const result = await response.json();
  if (expect ? response.status !== expect : !response.ok) throw new Error(`${method} ${route}: ${response.status} ${result.error || "request failed"}`);
  return result;
}
for (const [name, actor] of Object.entries(demo.actors)) tokens[name] = (await request(name, "/api/auth/login", { email: actor.email, password: actor.password })).token;
const browser = await chromium.launch({ headless: true }); let signature;
try { const page = await browser.newPage(); signature = await page.evaluate(() => { const canvas = document.createElement("canvas"); canvas.width = 640; canvas.height = 160; const context = canvas.getContext("2d"); context.fillStyle = "#123752"; context.font = "italic 54px Georgia"; context.fillText("Aurelia Mendoza", 12, 100); return canvas.toDataURL("image/png"); }); } finally { await browser.close(); }
const { defaultStructuredForm } = await import("@research-management/validations");
const spec = { ...defaultStructuredForm, name: "Proposal Defense Demonstration", signatureRequired: false, branding: { ...defaultStructuredForm.branding, schoolName: "University of the Assumption", collegeName: "College of Information Technology", templateName: "Proposal Defense Demonstration" }, presentation: [{ id: "clarity", title: "Presentation clarity", description: "Explains the research objectives and proposed method.", weight: 100 }], manuscript: [{ id: "scope", title: "Research scope and method", description: "Aligns the scope, method, and planned outputs.", weight: 100 }] };
demo.formSpec = spec;
if (!process.argv.includes("--class-only")) {
for (const key of ["schedule", "release"]) {
  const group = demo.defenseGroups[key];
  console.log(`Preparing ${key} eligibility and its exact-cycle signed letter.`);
  await request("professor", `/api/defense-management/eligibility/${group.projectId}/${group.stageId}/approve`, {});
  const form = new FormData(); form.append("researchIds", JSON.stringify([group.projectId])); form.append("recipientId", demo.actors.dean.id); form.append("subject", "Proposal defense approval request"); form.append("message", "Please review this fictional eligibility record and approve the attached request when appropriate."); form.append("file", new Blob([await fs.readFile(demo.letterPdf)], { type: "application/pdf" }), "Dean_Approval_Request.pdf");
  const sent = await request("professor", "/api/dean-inbox/requests", form);
  const threads = await request("dean", "/api/dean-inbox/threads");
  const thread = threads.threads.find((t) => t.research.id === group.projectId || t.deanInboxMessages?.some((m) => m.message.includes(group.projectId)));
  if (!thread) throw new Error(`Prepared ${key} signature request not in Dean inbox.`);
  const version = thread.versions.find((v) => v.versionNumber === thread.currentVersion);
  const signed = await request("dean", `/api/documents/versions/${version.id}/sign`, { password: demo.password, confirmation: true, signatureImage: signature, saveSignature: false, placements: [{ pageNumber: 1, x: .60, y: .70, width: .27, height: .10, includeName: true, includeDate: true }] });
  group.deanDocumentId = thread.id; group.signedVersionId = signed.version.id;
}
const release = demo.defenseGroups.release;
const start = new Date(Date.now() + 3 * 86400000), end = new Date(+start + 3600000);
const scheduled = await request("professor", "/api/defense-events", { name: "Prepared completed-evaluation example", title: "Prepared completed-evaluation example", defenseType: "PROPOSAL", researchIds: [release.projectId], scheduledStart: start.toISOString(), scheduledEnd: end.toISOString(), venue: "Research Presentation Room", invitees: [{ userId: demo.actors.chair.id, role: "PANEL_CHAIR", isRequired: true }, { userId: demo.actors.panelist.id, role: "PANELIST", isRequired: true }] });
release.sessionId = scheduled.event.sessions[0].id;
for (const actor of ["chair", "panelist"]) {
  const detail = await request("professor", `/api/defense-sessions/${release.sessionId}`);
  const invitation = detail.session.invitations.find((i) => i.inviteeId === demo.actors[actor].id);
  await request(actor, `/api/defense-management/invitations/${invitation.id}/respond`, { response: "ACCEPTED", suggestedAvailability: [] }, "PATCH");
}
await request("professor", `/api/defense-sessions/${release.sessionId}/structured-form`, { spec, manuscriptVersionId: release.versionId, publish: true, expectedMappingVersion: 0 }, "PUT");
await request("professor", "/api/defense-sessions/start", { sessionId: release.sessionId });
const packet = await request("professor", `/api/defense-sessions/${release.sessionId}/structured-form`);
for (const [index, actor] of ["chair", "panelist"].entries()) {
  const answers = { researchers: Object.fromEntries(packet.snapshot.roster.map((r) => [r.userId, { clarity: 4 + index }])), manuscript: { scope: 4 + index }, recommendation: "APPROVED", feedback: "The prepared proposal is ready for the next research stage.", signature: "" };
  await request(actor, `/api/defense-sessions/${release.sessionId}/structured-evaluation`, { revision: 0, answers }, "PUT");
  const preview = await request(actor, `/api/defense-sessions/${release.sessionId}/structured-evaluation/preview`, { revision: 1 });
  await request(actor, `/api/defense-sessions/${release.sessionId}/structured-evaluation/submit`, { revision: 1, previewHash: preview.evaluation.previewHash, confirmed: true });
}
const integrity = await request("professor", `/api/defense-sessions/${release.sessionId}/evaluation-integrity`);
if (integrity.status !== "CHAIN_VALID") throw new Error("Prepared evaluation history is not valid.");
await request("professor", `/api/defense-sessions/${release.sessionId}/release`, { decision: "APPROVED" }, "POST", 409);
demo.verifiedDefensePrerequisites = { separateDeanAccount: true, sameCycleSignature: true, allRequiredPanelistsAccepted: true, realPacketPublication: true, evaluationsSubmittedByOwnAccounts: true, evaluationHistoryValid: true, missingReleaseCheckpointBlocked: true };
} else {
  const sessions = await request("professor", "/api/defense-management");
  demo.defenseGroups.release.sessionId = sessions.sessions.find((s) => s.researchId === demo.defenseGroups.release.projectId).id;
  const integrity = await request("professor", `/api/defense-sessions/${demo.defenseGroups.release.sessionId}/evaluation-integrity`);
  if (integrity.status !== "CHAIN_VALID") throw new Error("Prepared evaluation history is invalid.");
}
await writeJson(file, demo);
console.log("Preparing private period grades and attendance.");
const recordRoot = `/api/class-records/${demo.workflowId}`;
await request("professor", `${recordRoot}/initialize`, {});
const get = () => request("professor", recordRoot);
const save = async (code, action, value) => { const record = await get(); return request("professor", `${recordRoot}/periods/${code}/${action}`, { expectedRevision: record.periods.find((p) => p.code === code).revision, ...value }); };
for (const code of ["PRELIM", "MIDTERM", "FINALS"]) {
  if (!(await get()).periods.find((p) => p.code === code).items.length) await save(code, "items", { title: code === "PRELIM" ? "Individual proposal presentation" : `${code === "MIDTERM" ? "Progress" : "Final"} research presentation`, kind: "INDIVIDUAL", maxPoints: 100, taskId: null });
  if (code === "PRELIM") {
    if (!(await get()).periods.find((p) => p.code === code).sessions.length) await save(code, "sessions", { date: new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }), title: "Research progress consultation" });
    const record = await get(), period = record.periods.find((p) => p.code === code);
    const roster = period.rows;
    await save(code, "scores", { entries: roster.map((r, i) => ({ studentId: r.id, itemId: period.items[0].id, state: "GRADED", score: 90 - i })) });
    await save(code, "attendance", { entries: roster.map((r, i) => ({ studentId: r.id, sessionId: period.sessions[0].id, status: i === 1 ? "LATE" : "PRESENT" })) });
  }
}
demo.prepared = true;
await writeJson(file, demo);
console.log("Coordinator scenarios prepared through normal role-authorized APIs. No official defense result or class grade has been released.");
