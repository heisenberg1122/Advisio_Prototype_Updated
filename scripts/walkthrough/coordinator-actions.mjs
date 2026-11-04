import path from "node:path";
import { root } from "./common.mjs";

export function coordinatorRoute(beat, d) {
  if (beat.action === "login") return "/login";
  if (["create", "milestones", "publish"].includes(beat.action)) return `/professor/dashboard?tab=builder&workflowId=${d.draftWorkflowId}`;
  if (beat.action === "resources") return `/professor/dashboard?tab=builder&workflowId=${d.draftWorkflowId}&workflowView=resources`;
  if (beat.action === "participation") return `/professor/dashboard?tab=builder&workflowId=${d.draftWorkflowId}&workflowView=participants`;
  if (["initial-review", "revised-review", "titles"].includes(beat.action)) return "/professor/dashboard?tab=submissions";
  if (beat.action === "progress" || beat.action === "adviser") return "/professor/dashboard?tab=tracking";
  if (beat.action === "class-record") return `/professor/class-record?workflowId=${d.workflowId}`;
  if (["eligibility", "dean-request", "schedule", "packet", "live-and-panel", "release-result"].includes(beat.action)) return "/professor/dashboard?tab=defense";
  if (beat.action === "announcements") return "/professor/dashboard?tab=announcements";
  return "/professor/dashboard";
}

export async function runCoordinatorAction(c) {
  const { page, demo: d, beat, auditOnly, button, click, point, ready, cue, switchActor, api, saveDemo } = c;
  const exactButton = (name) => page.getByRole("button", { name, exact: true });
  const text = (name) => page.getByText(name, { exact: true }).first();
  const builder = (view = "milestones") => `/professor/dashboard?tab=builder&workflowId=${d.draftWorkflowId}&workflowView=${view}`;
  const scoped = (name) => page.getByRole("button").filter({ hasText: name }).first();
  const choose = async (label, value) => { const field = page.getByLabel(new RegExp(`^${label}`, "i")).first(); await point(field); await field.selectOption(value); };
  const fill = async (label, value) => { const field = page.getByLabel(new RegExp(`^${label}`, "i")).first(); await field.fill(value); };
  const close = async () => { const close = page.getByRole("button", { name: /Close dialog|Close milestone|Close defense documents|Close modal/ }).last(); if (await close.count()) await click(close); else await click(button("Cancel")); };
  if (beat.action === "login") {
    await page.locator('input[type="email"]').fill(d.email); await page.locator('input[type="password"]').fill(d.password); await cue("Course Professor"); await click(button("Sign in")); await ready(page.getByRole("link", { name: "Overview", exact: true }));
  } else if (beat.action === "overview") {
    await point(text("Students Monitored")); await cue("The sidebar"); await point(page.getByRole("link", { name: "Workflow", exact: true })); await point(page.getByRole("link", { name: "Class Record", exact: true }));
  } else if (beat.action === "create") {
    await click(text("Create another workflow")); await page.locator("#workflow-name").fill("Course Research Planning Draft"); await page.locator("#workflow-description").fill("Private draft prepared for research planning and coordinator orientation."); await cue("Save the workflow"); await click(button("Create workflow")); await ready(text("Draft"));
  } else if (beat.action === "milestones") {
    await point(page.getByRole("heading").filter({ hasText: "Research planning and readiness" }).first()); await point(page.getByRole("button", { name: "Edit milestone Adviser Selection", exact: true }));
    await cue("Inspect a milestone"); await click(page.getByRole("button", { name: "Edit milestone Proposal Manuscript", exact: true })); await page.locator("#milestone-instructions").fill("Submit a PDF manuscript with aligned research objectives, scope, and method. Address the adviser feedback before coordinator review.");
    await point(page.getByLabel(/^Completed by/)); await cue("A relative target"); await point(page.locator("#milestone-target-completion")); await cue("Required Milestone Condition"); await point(page.getByLabel(/^Required Milestone Condition/));
    await click(button("Save changes")); await cue("Defense Eligibility is"); await click(page.getByRole("button", { name: "Edit milestone Proposal Defense Eligibility", exact: true })); await click(button("Advanced settings")); await point(page.getByLabel(/^Milestone type/)); await click(button("Cancel"));
  } else if (beat.action === "resources") {
    await click(button("Upload resource")); await page.getByPlaceholder("Official Manuscript Guide").fill("Research preparation guide"); await fill("Description", "Reference guide for the demonstration research lifecycle."); await page.locator('input[type="file"]').last().setInputFiles(d.samplePdf); await cue("Save the resource"); await click(button("Save")); await ready(text("Research preparation guide"));
  } else if (beat.action === "publish") {
    if (auditOnly && await text("Published").count()) return;
    await point(text("Workflow summary")); await cue("Select Publish"); await click(page.locator("button").filter({ hasText: /^\s*Publish\s*$/ })); await ready(text("Publish workflow")); await cue("confirm when"); await click(button("Publish workflow")); await ready(text("Published"));
  } else if (beat.action === "participation") {
    await click(button(await button("Generate code").count() ? "Generate code" : "Regenerate code"));
    const invitation = await api("professor", `/api/workflows/${d.draftWorkflowId}/invitation`, {});
    d.invitationCode = invitation.invitation?.inviteCode || invitation.invitation?.code || invitation.code; if (!d.invitationCode) throw new Error("Generated workflow code missing."); await saveDemo();
    await cue("We now switch"); await switchActor("joiner", `/student/workflows/join/${d.invitationCode}`); if (await button("Request to join").count()) await click(button("Request to join")); await ready(page.getByRole("link", { name: "Overview", exact: true }));
    await cue("Return to the coordinator"); await switchActor("professor", builder("participants")); await click(button("Join requests")); if (await button("Approve").count()) await click(button("Approve")); await click(button("Members")); await ready(text("Nina Mercado")); await cue("Direct invitations"); await click(button("Invitations")); await page.getByLabel("Search researchers by name or email").fill("Owen"); await ready(page.getByText("Owen Ramos", { exact: false }).first());
  } else if (beat.action === "adviser") {
    const requests = await api("adviser", "/api/adviser-requests"); const existing = requests.requests.find((r) => r.researchId === d.adviserProjectId);
    if (!existing) { await switchActor("adviser-leader", `/student/adviser-pool?projectId=${d.adviserProjectId}&milestoneId=${d.stages.ADVISER_SELECTION}&workflowId=${d.draftWorkflowId}`); await ready(text("Andrea Reyes")); await click(button("Request adviser")); await fill("Message to adviser", "Please consider our fictional research group for proposal advising. We will address your feedback in our manuscript."); await click(button("Submit adviser request")); await ready(page.getByText(/adviser request was sent/i).first()); }
    await cue("The request remains pending"); await switchActor("adviser-leader", `/student/tasks/milestone-${d.stages.ADVISER_SELECTION}?projectId=${d.adviserProjectId}&workflowId=${d.draftWorkflowId}`); await ready(page.getByText(/Request Pending|Waiting for adviser/i).first());
    await cue("adviser's own account"); const pending = (await api("adviser", "/api/adviser-requests")).requests.find((r) => r.researchId === d.adviserProjectId); await switchActor("adviser", `/adviser/dashboard?requestId=${pending.id}`); await click(button("Accept request")); await click(button("Accept request"));
    await cue("return to coordinator"); await switchActor("professor", "/professor/dashboard?tab=tracking"); await point(text("Research title not registered"));
  } else if (beat.action === "titles") {
    await switchActor("title-leader", `/student/tasks/milestone-${d.stages.TITLE_PROPOSAL}?projectId=${d.titleProjectId}&workflowId=${d.draftWorkflowId}`); await ready(page.getByText(/Title Proposal|Proposed titles/, { exact: false }).first());
    if (await page.getByLabel("Title proposal 1", { exact: true }).count()) for (const [i, value] of ["Campus Research Resource Coordination Portal", "Research Consultation Scheduling and Records System", "College Project Progress Monitoring Dashboard"].entries()) await page.getByLabel(`Title proposal ${i + 1}`, { exact: true }).fill(value);
    if (await button("Submit title proposals").count()) await click(button("Submit title proposals")); await cue("Switch back"); await switchActor("professor", "/professor/dashboard?tab=submissions"); await click(scoped("Research Group E")); await ready(page.getByRole("dialog", { name: "Review title proposal" }));
    await cue("select a title"); await page.getByRole("radio").first().check(); await click(button("Approve selected title")); await ready(page.getByText(/Title approved|Registered|Approved/i).first());
  } else if (beat.action === "progress") {
    await switchActor("professor", "/professor/dashboard?tab=monitoring"); await ready(text("Campus Research Resource Coordination Portal")); await point(text("Campus Research Resource Coordination Portal")); await cue("Open Progress"); await click(page.getByRole("link", { name: "Progress", exact: true })); await point(text("Research progress"));
  } else if (["initial-review", "revised-review"].includes(beat.action)) {
    const revised = beat.action === "revised-review", name = revised ? "Campus Facility Directory and Accessibility Requirements Assessment" : "CampusWay: A Web Based Campus Facility Locator and Navigation System";
    if (revised) {
      const data = await api("professor", "/api/research"), project = data.projects.find((p) => p.title === name), submission = project.taskSubmissions.find((s) => s.status === "SUBMITTED");
      const assignment = await api("professor", `/api/documents/versions/${submission.documentVersionId}/reviewer-assignments`, { reviewerId: d.actors.adviser.id, reviewType: "ADVISER", isRequired: true });
      await api("adviser", `/api/reviewer-assignments/${assignment.assignment.id}/decision`, { recommendation: "APPROVE", overallComment: "The prepared revised manuscript addresses the adviser review points.", comments: [] });
      await page.reload();
    }
    await click(scoped(name)); await ready(page.getByText("Select text on the page to attach a comment.", { exact: true }));
    if (!revised) {
      await cue("Select a passage"); const span = page.locator(".advisio-pdf-text span").filter({ hasText: "CampusWay:" }).first(); await ready(span); const box = await span.boundingBox(); await page.mouse.move(box.x + 2, box.y + box.height / 2); await page.mouse.down(); await page.mouse.move(box.x + Math.min(box.width - 2, 270), box.y + box.height / 2, { steps: 20 }); await page.mouse.up(); await click(button("Comment on selection")); await page.getByPlaceholder("Write feedback or a reply…").fill("Please align the proposed outputs with the scope statement."); await click(button("Post comment"));
      await cue("Enter decision feedback"); await fill("Decision feedback", "Clarify the research scope and align the proposed outputs before resubmitting."); await click(button("Request revision"));
    } else {
      const versions = page.getByLabel("Document version", { exact: true }); const options = await versions.locator("option").evaluateAll((nodes) => nodes.map((o) => o.value)); await versions.selectOption(options.at(-1)); await cue("Adviser and other"); await versions.selectOption(options[0]); await cue("coordinator can approve"); await click(button("Approve submission"));
    }
  } else if (beat.action === "class-record") {
    await point(page.getByText("Prelim", { exact: true }).first()); await page.getByRole("tab", { name: "Midterm", exact: true }).click(); await page.getByRole("tab", { name: "Finals", exact: true }).click(); await page.getByRole("tab", { name: "Prelim", exact: true }).click();
    await cue("Review the prepared activity"); const score = page.getByRole("spinbutton").first(); await point(score); await score.fill("91"); await page.getByLabel("Correction or release note", { exact: true }).fill("Prepared score correction reviewed for the demonstration class record."); await click(button("Save drafts")); await click(button("Attendance")); await point(page.getByRole("combobox", { name: /attendance$/ }).first()); await ready(page.getByText(/All draft changes saved|Drafts saved/i).first());
    await cue("Release period publishes"); await click(button("Release period")); await click(button("Release grades")); await ready(page.getByText(/6 \/ 6/).first()); await cue("My Grades view"); await switchActor("student", `/student/grades?workflowId=${d.workflowId}`); await ready(page.getByText(/Released|Prelim/).first());
  } else if (beat.action === "eligibility") {
    const row = page.locator(".cdf-eligibility").getByText("Defense Group 1", { exact: true }).locator("..").locator(".."); await point(row); await cue("Approve its eligibility"); await click(row.getByRole("button", { name: "Approve eligibility", exact: true })); await ready(row.getByText("Defense cycle approved", { exact: true }));
  } else if (beat.action === "dean-request") {
    await click(button("Request Dean signature")); await page.getByRole("checkbox").filter({ visible: true }).first().check(); await choose("Send to", d.actors.dean.id); await fill("Subject", "Proposal defense approval for Defense Group 1"); await page.getByLabel(/^Attach request letter/).setInputFiles(d.letterPdf); await click(button("Send to Dean")); await cue("switch to the dean's own account"); await switchActor("dean", "/admin/inbox?view=signature-requests"); await click(button("Add signature")); await ready(page.getByRole("button", { name: "type", exact: true })); await click(exactButton("type")); await fill("Type your signature", "Aurelia Mendoza"); await fill("Confirm your password", d.password); await page.getByRole("checkbox").filter({ visible: true }).last().check(); await click(button("Confirm & Sign")); await ready(text("Your signed PDF has been saved successfully.")); await click(exactButton("Done")); await ready(text("Signed"));
  } else if (beat.action === "schedule") {
    const priorEvents = await api("professor", "/api/defense-events");
    let session = priorEvents.events.flatMap((e) => e.sessions).find((s) => s.researchId === d.defenseGroups.schedule.projectId || s.research?.id === d.defenseGroups.schedule.projectId);
    if (!session) {
    await click(button("Create defense event")); await page.getByLabel(/Library Resource Tracking Prototype/).check(); await choose("Defense type", "PROPOSAL_DEFENSE"); const date = new Date(Date.now() + 4 * 86400000).toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }); await fill("Event date", date); await fill("Event starts", "09:00"); await fill("Event ends", "10:00"); await fill("Venue", "Research Presentation Room"); await choose("Panel chair", d.actors.chair.id); await page.getByLabel(/^Marisol Cruz/).check(); await cue("Create Event and Invite"); const createdResponse = page.waitForResponse((r) => r.request().method() === "POST" && new URL(r.url()).pathname === "/api/defense-events"); await click(button("Create event & invite"));
    const response = await createdResponse; const data = await response.json(); if (!response.ok()) throw new Error(data.error || "Defense creation failed"); session = data.event.sessions.find((s) => s.researchId === d.defenseGroups.schedule.projectId); } if (!session) throw new Error("Created defense session missing."); d.defenseGroups.schedule.sessionId = session.id; await saveDemo();
    await cue("participants' own accounts"); for (const actor of ["chair", "panelist"]) { await switchActor(actor, `/panelist/defenses/${session.id}`); await click(button("Accept invitation")); }
    await switchActor("professor", "/professor/dashboard?tab=defense");
  } else if (beat.action === "packet") {
    const group = d.defenseGroups.schedule, data = await api("professor", `/api/defense-sessions/${group.sessionId}/structured-form`);
    if (!data.snapshot) await api("professor", `/api/defense-sessions/${group.sessionId}/structured-form`, { spec: d.formSpec, manuscriptVersionId: group.versionId, publish: false, expectedMappingVersion: 0 }, "PUT");
    const article = page.locator(".cdf-event").filter({ hasText: "Library Resource Tracking Prototype" }).first(); await click(article.getByRole("button", { name: /Defense documents/ })); await ready(page.getByRole("dialog", { name: "Defense documents" })); await point(page.getByLabel("Approved defense manuscript")); await cue("Configure the structured form"); await click(button("Configure form")); await point(page.locator('input[value="Presentation clarity"]')); await cue("publish the packet"); await click(button("Share with panelists")); await ready(page.getByText(/shared with panelists|Published/i).first());
  } else if (beat.action === "live-and-panel") {
    const group = d.defenseGroups.schedule, article = page.locator(".cdf-event").filter({ hasText: "Library Resource Tracking Prototype" }).first(); if (await article.getByRole("button", { name: /Start live defense|Start defense|Call group/ }).count()) await click(article.getByRole("button", { name: /Start live defense|Start defense|Call group/ }));
    const packet = await api("professor", `/api/defense-sessions/${group.sessionId}/structured-form`);
    const answers = { researchers: Object.fromEntries(packet.snapshot.roster.map((r) => [r.userId, { clarity: 4 }])), manuscript: { scope: 4 }, recommendation: "APPROVED", feedback: "The objectives and method are aligned in this prepared demonstration.", signature: "" };
    const currentEvaluation = await api("chair", `/api/defense-sessions/${group.sessionId}/structured-evaluation`); if (!currentEvaluation.evaluation?.revision) await api("chair", `/api/defense-sessions/${group.sessionId}/structured-evaluation`, { revision: 0, answers }, "PUT");
    await cue("panelist's own workspace"); await switchActor("chair", `/panelist/dashboard?tab=evaluation&sessionId=${group.sessionId}`); await ready(page.getByText("Live defense · Your private draft", { exact: true })); await click(button("Review evaluation PDF")); await ready(page.getByText("Review your generated evaluation PDF", { exact: true })); await page.getByRole("checkbox").filter({ visible: true }).last().check(); await click(button("Submit final evaluation")); await ready(page.getByText(/Final evaluation.*Locked|Final evaluation submitted and locked/).first());
  } else if (beat.action === "release-result") {
    const group = d.defenseGroups.release, article = page.locator(".cdf-event").filter({ hasText: "Student Research Support Portal" }).first(); await click(article.getByRole("button", { name: /Defense documents/ })); await click(button("Evaluation results")); await ready(text("Consolidated evaluations")); if (auditOnly && (await api("professor", `/api/defense-sessions/${group.sessionId}`)).session.releasedAt) { await point(page.getByRole("dialog", { name: "Defense documents" }).getByText("Approved", { exact: true }).first()); return; } await cue("verify the recorded evaluation history"); await click(button("Verify records")); const download = page.waitForEvent("download"); await click(button("Download checkpoint")); await (await download).saveAs(path.join(root, ".walkthrough/coordinator/retained-evaluation-checkpoint.json")); await click(button("I retained this checkpoint"));
    await cue("Select the official decision"); await page.getByRole("dialog", { name: "Defense documents" }).getByLabel("Official defense result", { exact: true }).selectOption("APPROVED"); await cue("release the result"); await click(button("Release official result")); await ready(page.getByRole("dialog", { name: "Defense documents" }).getByText("Approved", { exact: true }).first());
    const released = await api("professor", `/api/defense-sessions/${group.sessionId}`); if (!released.session.releasedAt) throw new Error("Official result was not released.");
  } else if (beat.action === "announcements") {
    await choose("Workflow", d.workflowId); await fill("Title", "Research progress consultation reminder"); await fill("Message", "Please prepare your proposal status, adviser feedback, and next milestone requirements for our research progress consultation. Demonstration notice."); await cue("publish it"); await click(button("Publish to workflow")); await ready(page.getByText(/Published|Announcement.*sent|announced/i).first()); await cue("Return to Progress"); await click(page.getByRole("link", { name: "Progress", exact: true }));
  } else throw new Error(`Unknown coordinator capture action: ${beat.action}`);
}
