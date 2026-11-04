import fs from "node:fs/promises";

export function adviserRoute(b, d) {
  if (b.action === "login") return "/login";
  if (["requests", "respond"].includes(b.action)) return `/adviser/dashboard?requestId=${d.requestAcceptId}`;
  if (b.action === "advisees") return "/adviser/dashboard?tab=advisees";
  if (["milestones", "documents", "history", "readiness"].includes(b.action)) return `/adviser/advisees/${d.projectId}?section=${({ milestones: "milestones", documents: "documents", history: "consultations", readiness: "defense" })[b.action]}`;
  if (b.action === "assigned-review") return "/adviser/reviews";
  if (b.action === "feedback") return `/adviser/reviews?assignmentId=${d.primaryAssignmentId}`;
  if (b.action === "revised") return `/adviser/advisees/${d.projectId}?section=reviews`;
  if (b.action === "sign") return "/adviser/inbox";
  if (b.action === "consultation-request") return "/adviser/dashboard?tab=consultations";
  if (b.action === "consultation-notes") return "/adviser/dashboard?tab=history";
  if (b.action === "messages") return "/adviser/dashboard?tab=group-chats";
  return "/adviser/dashboard";
}

export async function runAdviserAction(c) {
  const { page, demo: d, beat, auditOnly, button, click, point, ready, cue, api, saveDemo } = c;
  const exact = (name) => page.getByRole("button", { name, exact: true });
  const text = (name) => page.getByText(name, { exact: true }).filter({ visible: true }).first();
  const go = async (route) => { await page.goto(d.url + route, { waitUntil: "domcontentloaded" }); await ready(page.getByRole("link", { name: "Overview", exact: true })); };
  const workspace = (section) => `/adviser/advisees/${d.projectId}?section=${section}`;
  const selectPassage = async (phrase) => {
    const span = page.locator(".advisio-pdf-text span").filter({ hasText: phrase }).first(); await ready(span);
    await span.scrollIntoViewIfNeeded(); const box = await span.boundingBox();
    await page.mouse.move(box.x + 2, box.y + box.height / 2); await page.mouse.down(); await page.mouse.move(box.x + Math.min(box.width - 2, 260), box.y + box.height / 2, { steps: 20 }); await page.mouse.up();
    await click(button("Comment on selection"));
  };
  if (beat.action === "login") {
    await page.locator('input[type="email"]').fill(d.email); await page.locator('input[type="password"]').fill(d.password); await click(button("Sign in")); await ready(page.getByRole("link", { name: "My Advisees", exact: true }));
  } else if (beat.action === "overview") {
    await point(text("Advisee Groups")); await cue("The sidebar");
    for (const name of ["My Advisees", "Reviews", "Consultations", "Messages", "Inbox"]) await point(page.getByRole("link", { name, exact: true }));
  } else if (beat.action === "requests") {
    await point(text("Please guide our research planning and review the scope of our proposed study.")); await point(button("Accept request")); await point(button("Reject"));
  } else if (beat.action === "respond") {
    const requests = (await api("adviser", "/api/adviser-requests")).requests;
    if (requests.find((r) => r.id === d.requestAcceptId)?.status === "PENDING") {
      await click(button("Accept request")); await page.getByPlaceholder("Share your expectations or next steps.").fill("Please prepare a clear scope statement and address the recorded manuscript feedback."); await click(button("Accept request"));
    }
    await cue("If you cannot"); await go(`/adviser/dashboard?requestId=${d.requestDeclineId}`);
    if ((await api("adviser", "/api/adviser-requests")).requests.find((r) => r.id === d.requestDeclineId)?.status === "PENDING") {
      await click(button("Reject")); await page.getByPlaceholder("Briefly explain your decision or suggest another direction.").fill("This specialized proposal is outside my advising focus. Please consult the coordinator for a suitable adviser."); await click(button("Decline request"));
    }
    await go("/adviser/dashboard?tab=advisees"); await ready(page.getByRole("link", { name: /Open Research Group D/ }));
  } else if (beat.action === "capacity") {
    await point(text("Advisee Groups")); await point(page.getByText(/of 12/).first());
  } else if (beat.action === "advisees") {
    await click(page.getByRole("link", { name: new RegExp(`Open Research Group A:`) })); await ready(text("Current stage"));
    await cue("Open a group"); await point(page.getByRole("tab", { name: "Documents", exact: true })); await point(page.getByRole("tab", { name: "Milestones", exact: true })); await point(page.getByRole("tab", { name: "Reviews & Feedback", exact: true }));
  } else if (beat.action === "milestones") {
    await ready(text("Research milestones")); await point(page.locator("main").getByText(/Proposal manuscript|Research proposal/i).first()); await point(page.getByText(/Current|Approved|Pending/i).last());
  } else if (beat.action === "documents") {
    await click(page.locator("summary").filter({ hasText: "Version history (2)" }).first()); await point(page.getByText(/Version 2 ·/).first()); await point(page.getByText(/Version 1 ·/).first()); await point(page.getByRole("button", { name: "Preview version 2", exact: true }).first());
  } else if (beat.action === "assigned-review") {
    await ready(text("Research Group A"));
    await cue("Before providing"); await click(page.locator("article").filter({ has: page.getByText("Research Group A", { exact: true }) }).getByRole("button", { name: "Review manuscript", exact: true }).first()); await ready(page.locator(".advisio-pdf-text span").first()); await point(page.getByLabel("Recommendation", { exact: true }));
  } else if (beat.action === "feedback") {
    if (auditOnly) {
      const state = (await api("adviser", "/api/reviewer-assignments/me")).assignments.find((a) => a.id === d.primaryAssignmentId);
      if (state?.status === "COMPLETED") { await go(workspace("reviews")); await point(page.getByText("Minor revision", { exact: false }).first()); return; }
    }
    await selectPassage("CampusWay:"); await page.getByPlaceholder("Write feedback or a reply…").fill("Please align the proposed outputs with the approved research scope."); await click(button("Post comment"));
    await cue("For this example"); await page.getByLabel("Recommendation", { exact: true }).selectOption("MINOR_REVISION"); await page.getByLabel("Overall feedback", { exact: false }).fill("Clarify the objectives and align the proposed outputs with the approved research scope before resubmitting.");
    await click(button("Submit permanent decision")); await ready(text("Your decision and feedback were saved to this exact submitted version."));
  } else if (beat.action === "revised") {
    if (!d.revisedVersionId) {
      const uploaded = await api("student", `/api/documents/${d.primaryDocumentId}/versions`, { file: { name: "Revised_Proposal.pdf", mimeType: "application/pdf", buffer: await fs.readFile(d.revisedPdf) } }, "MULTIPART");
      const result = await api("student", `/api/workflows/tasks/${d.primaryTaskId}/submissions`, { researchId: d.projectId, documentId: d.primaryDocumentId, documentVersionId: uploaded.version.id, note: "The revised manuscript addresses the adviser's scope and objective feedback." });
      d.revisedVersionId = result.submission.documentVersionId;
      const route = `/api/documents/versions/${d.revisedVersionId}/reviewer-assignments`;
      const coordinator = await api("professor", "/api/reviewer-assignments/me");
      if (!coordinator.assignments.some((a) => a.documentVersion.id === d.revisedVersionId && a.status === "ACTIVE")) await api("professor", route, { reviewerId: d.actors.professor.id, reviewType: "COORDINATOR", isRequired: true });
      const current = await api("adviser", "/api/reviewer-assignments/me");
      const existing = current.assignments.find((a) => a.documentVersion.id === d.revisedVersionId && a.status === "ACTIVE");
      const assignment = existing || (await api("professor", route, { reviewerId: d.actors.adviser.id, reviewType: "ADVISER", isRequired: true })).assignment;
      d.revisedAssignmentId = assignment.id; d.revisedVersionNumber = assignment.documentVersion?.versionNumber || (await api("adviser", "/api/reviewer-assignments/me")).assignments.find((a) => a.id === assignment.id).documentVersion.versionNumber; await saveDemo();
    }
    await go(workspace("documents")); await click(page.locator("summary").filter({ hasText: /Version history/ }).first()); await point(page.getByText(new RegExp(`Version ${d.revisedVersionNumber} ·`)).first()); await point(page.getByText(/Version 2 ·/).first());
    await cue("then open the current assignment"); await go(`/adviser/reviews?assignmentId=${d.revisedAssignmentId}`); await ready(page.locator(".advisio-pdf-text span").first());
    await page.getByLabel("Overall feedback", { exact: false }).fill("The revised objectives and outputs now match the approved scope."); await page.getByLabel("Recommendation", { exact: true }).selectOption("APPROVE"); await page.getByLabel("Detailed review comment", { exact: true }).fill("The revised scope is clear and consistent with the research objectives.");
    await click(button("Submit permanent decision")); await ready(text("Your decision and feedback were saved to this exact submitted version."));
  } else if (beat.action === "sign") {
    if (!d.endorsementMailId) {
      const response = await api("student", "/api/mail/messages", { recipientId: d.actors.adviser.id, subject: "Adviser endorsement request", body: "Please review this demonstration endorsement form after the manuscript review. This fictional PDF contains no existing signature.", files: { name: "Adviser_Endorsement.pdf", mimeType: "application/pdf", buffer: await fs.readFile(d.letterPdf) } }, "MULTIPART");
      d.endorsementMailId = response.thread?.id || response.message?.threadId; await saveDemo(); await go("/adviser/inbox");
    }
    await click(page.getByText("Adviser endorsement request", { exact: true }).first()); await click(page.getByRole("button", { name: "Actions for Adviser_Endorsement.pdf", exact: true })); await click(page.getByRole("menuitem", { name: "Review & sign", exact: true })); await ready(exact("type")); await click(exact("type")); await page.getByLabel("Type your signature", { exact: true }).fill("Andrea Reyes"); await click(exact("Fit page"));
    const position = page.getByRole("button", { name: "Signature position. Drag or use arrow keys to move.", exact: true }); await point(position); await position.press("ArrowLeft");
    await cue("Confirm your password"); await page.getByLabel("Confirm your password", { exact: true }).fill(d.password); await page.getByRole("checkbox").filter({ visible: true }).last().check(); await click(button("Confirm & Sign")); await ready(text("Your signed PDF has been saved successfully.")); await point(exact("Download signed copy"));
  } else if (beat.action === "consultation-request") {
    await point(page.getByText("Proposal scope and revision planning", { exact: true })); await cue("use the appropriate action");
    const current = (await api("adviser", "/api/consultations")).consultations.find((c) => c.id === d.pendingConsultationId);
    if (String(current?.status).toUpperCase() !== "SCHEDULED") {
      const response = page.waitForResponse((r) => r.request().method() === "PATCH" && new URL(r.url()).pathname === `/api/consultations/${d.pendingConsultationId}/approve`);
      await click(button("Approve Consultation")); const approved = await (await response).json(); if (String(approved.consultation?.status).toUpperCase() !== "SCHEDULED") throw Error("Consultation approval was not recorded.");
    } else if (!auditOnly) throw Error("Production consultation must begin as a pending request.");
    await click(page.getByRole("link", { name: "Calendar", exact: true })); await ready(text("Your Advisio schedule"));
  } else if (beat.action === "consultation-notes") {
    const card = page.locator("div").filter({ has: text("Completed proposal guidance session") }).filter({ has: page.getByRole("button", { name: "View / Edit Transcript & Notes", exact: true }) }).last();
    await point(text("Completed proposal guidance session")); await cue("Switch to a separate completed"); await click(button("Transcript & Notes")); await click(button("Advising Minutes & Action Items"));
    await page.getByPlaceholder("Summarize key feedback, methodology decisions, and chapter recommendations...").fill("Reviewed the aligned objectives, approved scope, and revised proposal outputs. Discussed the evidence needed for the next coordinator review.");
    await page.getByPlaceholder(/^e.g./).last().fill("Verify all objectives against the approved scope.\nPrepare the remaining coordinator requirements.\nBring the updated manuscript to the next consultation."); await click(button("Save to Consultation History")); await ready(page.getByText(/Reviewed the aligned objectives/).first());
  } else if (beat.action === "history") {
    await point(page.getByText(/Reviewed the aligned objectives/).first()); await point(page.getByText("Prepare the remaining coordinator requirements.", { exact: true })); await cue("recorded group activities"); await click(page.getByRole("tab", { name: "Activity", exact: true })); await ready(text("Project activity"));
  } else if (beat.action === "readiness") {
    await ready(text("Defense readiness")); await point(text("Required workflow milestones completed")); await point(text("Dean-signed defense approval received")); await cue("Official Copies"); await click(page.getByRole("link", { name: "Official Copies", exact: true })); await ready(page.getByText(/Official copies|Official Copies/).first());
  } else if (beat.action === "messages") {
    await click(page.getByRole("button").filter({ hasText: "CampusWay adviser guidance" }).first()); const input = page.getByPlaceholder("Write a message… (Press Enter to send, Shift+Enter for new line)"); await input.fill("Good afternoon. I've reviewed your revised manuscript. Please check the feedback and prepare the remaining requirements."); await input.press("Enter"); await ready(page.getByText("Good afternoon. I've reviewed your revised manuscript. Please check the feedback and prepare the remaining requirements.", { exact: true }));
    await cue("Inbox"); await click(page.getByRole("link", { name: "Inbox", exact: true })); await click(text("Proposal revision follow-up")); await ready(page.getByText(/Dear Professor Reyes/).filter({ visible: true }).first()); await point(button("Reply"));
  } else if (beat.action === "tools") {
    await click(page.getByRole("link", { name: "Calendar", exact: true })); await ready(text("Your Advisio schedule")); await go("/adviser/profile"); await ready(page.getByText("Andrea Reyes", { exact: false }).first()); await go("/adviser/settings"); await ready(page.getByText(/Settings/).first()); await cue("Return to Overview"); await go("/adviser/dashboard"); await point(text("Advisee Groups"));
  }
}

