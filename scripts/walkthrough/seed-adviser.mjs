import fs from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { seedCoordinator } from "./seed-coordinator.mjs";

// Static, fictional preparation only. Recorded decisions use native role APIs.
export async function seedAdviser(db, storageRoot) {
  const d = await seedCoordinator(db, storageRoot);
  const adviser = await db.user.update({ where: { id: d.actors.adviser.id }, data: { maxAdviseeGroups: 12 } });
  await db.reviewerAssignment.updateMany({ where: { reviewerId: d.actors.professor.id, status: "ACTIVE" }, data: { reviewerId: adviser.id, reviewType: "ADVISER", isRequired: true } });
  await db.workflow.update({ where: { id: d.draftWorkflowId }, data: { status: "PUBLISHED", version: 1, publishedAt: new Date() } });
  const requestAccept = await db.adviserRequest.create({ data: { researchId: d.adviserProjectId, requestedById: d.actors["adviser-leader"].id, adviserId: adviser.id, workflowStageId: d.stages.ADVISER_SELECTION, status: "PENDING", note: "Please guide our research planning and review the scope of our proposed study." } });
  await db.researchMember.deleteMany({ where: { researchId: d.titleProjectId, userId: adviser.id, projectRole: "ADVISER" } });
  const requestDecline = await db.adviserRequest.findFirstOrThrow({ where: { researchId: d.titleProjectId, adviserId: adviser.id } });
  await db.adviserRequest.update({ where: { id: requestDecline.id }, data: { status: "PENDING", respondedAt: null, note: "Please consider advising our specialized research proposal." } });
  const primary = await db.researchProject.findUniqueOrThrow({ where: { id: d.projectId }, include: { documents: { include: { versions: true } }, members: true } });
  const document = primary.documents.find((x) => x.currentVersion === 2);
  const version = document.versions.find((x) => x.versionNumber === 2);
  const assignment = await db.reviewerAssignment.findFirstOrThrow({ where: { documentVersionId: version.id, reviewerId: adviser.id, status: "ACTIVE" } });
  const submission = await db.taskSubmission.findFirstOrThrow({ where: { documentVersionId: version.id } });
  // A separate current coordinator assignment demonstrates remaining faculty gates.
  await db.reviewerAssignment.create({ data: { researchId: primary.id, documentId: document.id, documentVersionId: version.id, reviewerId: d.actors.professor.id, reviewType: "COORDINATOR", assignedById: d.actors.professor.id, status: "ACTIVE", isRequired: true } });
  const pdf = await PDFDocument.create(), font = await pdf.embedFont(StandardFonts.Helvetica), bold = await pdf.embedFont(StandardFonts.HelveticaBold), page = pdf.addPage([595, 842]);
  page.drawText("ADVISIO | Fictional demonstration record", { x: 48, y: 792, font, size: 10 });
  page.drawText("Revised research proposal", { x: 48, y: 750, font: bold, size: 18 });
  for (const [i, line] of ["Revised manuscript - prepared for submission", "Objectives and proposed outputs now follow the approved scope.", "The method, research questions, and deliverables are aligned.", "The revision addresses the adviser's recorded feedback."].entries()) page.drawText(line, { x: 48, y: 700 - i * 36, font, size: 11 });
  const revisedPdf = path.join(storageRoot, "CampusWay_Proposal_v3.pdf"); await fs.writeFile(revisedPdf, await pdf.save());
  const endorsement = await PDFDocument.create(), endorsementFont = await endorsement.embedFont(StandardFonts.Helvetica), endorsementPage = endorsement.addPage([595, 842]);
  for (const [i, line] of ["ADVISIO | Fictional demonstration record", "Adviser manuscript endorsement", "Research Group A", "The current manuscript has been reviewed by its assigned adviser.", "This endorsement is separate from official defense-result release.", "Adviser signature:"].entries()) endorsementPage.drawText(line, { x: 48, y: 770 - i * 56, font: endorsementFont, size: i === 1 ? 18 : 11 });
  await fs.writeFile(d.letterPdf, await endorsement.save());
  const consultations = await db.consultation.findMany({ orderBy: { createdAt: "asc" } });
  const pending = consultations.find((c) => c.researchId === primary.id);
  await db.consultation.update({ where: { id: pending.id }, data: { title: "Proposal scope and revision planning", status: "REQUESTED", meetingUrl: "https://meet.google.com/new" } });
  const completed = await db.consultation.create({ data: { researchId: primary.id, createdBy: d.actors.student.id, title: "Completed proposal guidance session", description: "Prepared completed consultation for the notes demonstration.", scheduledStart: new Date(Date.now() - 86400000), scheduledEnd: new Date(Date.now() - 82800000), status: "COMPLETED", meetingUrl: "https://meet.google.com/new", participants: { create: [adviser.id, d.actors.student.id].map((userId) => ({ userId, attendanceStatus: "ACCEPTED" })) } } });
  await db.consultationNote.create({ data: { consultationId: completed.id, authorId: adviser.id, notes: "Prepared completed session. Review scope alignment and the next manuscript revision.", actionItems: ["Align objectives with the approved scope."] } });
  const chat = await db.chatGroup.create({ data: { title: "CampusWay adviser guidance", description: "Fictional research guidance conversation.", createdByAdviserId: adviser.id, createdByUserId: adviser.id, adviserName: `${adviser.firstName} ${adviser.lastName}`, relatedResearchGroupId: primary.id, participants: { create: [adviser.id, d.actors.student.id].map((userId) => ({ userId, roleSnapshot: userId === adviser.id ? "ADVISER" : "RESEARCHER", status: "ACCEPTED", isAdmin: userId === adviser.id, respondedAt: new Date() })) }, messages: { create: { senderId: d.actors.student.id, senderUserId: d.actors.student.id, senderName: "Mikaela Santos", senderRole: "RESEARCHER", message: "Good afternoon. Please review our revised proposal and advise us on the remaining requirements." } } } });
  const mail = await db.mailThread.create({ data: { subject: "Proposal revision follow-up", createdById: d.actors.student.id, participants: { create: [{ userId: d.actors.student.id, recipientType: "SENDER" }, { userId: adviser.id, recipientType: "TO" }] }, messages: { create: { senderId: d.actors.student.id, body: "Dear Professor Reyes, please review the recorded manuscript feedback and our planned revision actions. This is a fictional orientation message.", sentAt: new Date() } } } });
  return { ...d, email: d.actors.adviser.email, password: d.actors.adviser.password, userId: adviser.id, requestAcceptId: requestAccept.id, requestDeclineId: requestDecline.id, primaryTitle: primary.title, primaryDocumentId: document.id, primaryVersionId: version.id, primaryAssignmentId: assignment.id, primarySubmissionId: submission.id, primaryTaskId: submission.taskId, primaryMilestoneId: document.milestoneId, revisedPdf, pendingConsultationId: pending.id, completedConsultationId: completed.id, chatId: chat.id, mailThreadId: mail.id };
}
