import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { seedCoordinator } from "./seed-coordinator.mjs";

export async function seedPanelist(db, storageRoot) {
  const d = await seedCoordinator(db, storageRoot);
  const pdf = await PDFDocument.create(), font = await pdf.embedFont(StandardFonts.Helvetica), bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  for (const title of ["Panelist evaluation form", "Written feedback and recommendation"]) {
    const page = pdf.addPage([595, 842]); page.drawText("ADVISIO | Fictional orientation record", { x: 48, y: 792, size: 10, font }); page.drawText(title, { x: 48, y: 750, size: 18, font: bold });
    for (const [i, line] of ["Research objectives are clear.", "Method and planned outputs match the scope.", "Presentation and manuscript assessment: 4 / 5", "Feedback: Clarify the intended research evidence.", "Recommendation: Approved with minor revisions", "Panelist signature:"].entries()) page.drawText(line, { x: 48, y: 692 - i * 70, size: 11, font });
  }
  const templatePath = path.join(storageRoot, "Panelist_Evaluation_Template.pdf"), bytes = Buffer.from(await pdf.save()); await fs.writeFile(templatePath, bytes);
  const group = d.defenseGroups.schedule;
  const doc = await db.document.create({ data: { researchId: group.projectId, documentType: "EVALUATION_TEMPLATE", title: "Panelist evaluation PDF", createdBy: d.actors.professor.id, storageProvider: "LOCAL", lifecycleStatus: "APPROVED" } });
  const version = await db.documentVersion.create({ data: { documentId: doc.id, versionNumber: 1, fileName: "Panelist_Evaluation_Template.pdf", mimeType: "application/pdf", fileSize: BigInt(bytes.length), storagePath: templatePath, uploadedBy: d.actors.professor.id, manuscriptStatus: "APPROVED", contentChecksum: createHash("sha256").update(bytes).digest("hex"), isImmutable: true } });
  const pending = d.defenseGroups.readiness;
  const eligibilityTask = await db.workflowTask.findFirstOrThrow({ where: { stageId: pending.stageId } });
  // Separate invited panelist for the decline example, using a second seeded project.
  const baseProject = await db.researchProject.findUniqueOrThrow({ where: { id: d.projectId }, include: { documents: { include: { versions: true } } } });
  const manuscript = baseProject.documents.find((doc) => doc.currentVersion === 2), latest = manuscript.versions.find((v) => v.versionNumber === 2);
  await db.document.update({ where: { id: manuscript.id }, data: { lifecycleStatus: "APPROVED" } });
  await db.documentVersion.update({ where: { id: latest.id }, data: { manuscriptStatus: "APPROVED" } });
  await db.taskSubmission.updateMany({ where: { documentVersionId: latest.id }, data: { status: "APPROVED", reviewedAt: new Date() } });
  const assignment = await db.reviewerAssignment.findFirstOrThrow({ where: { documentVersionId: latest.id, reviewerId: d.actors.professor.id } });
  await db.reviewerAssignment.update({ where: { id: assignment.id }, data: { status: "COMPLETED", completedAt: new Date() } });
  await db.review.create({ data: { assignmentId: assignment.id, documentId: manuscript.id, documentVersionId: latest.id, reviewerId: d.actors.professor.id, reviewType: "COORDINATOR", status: "SUBMITTED", recommendation: "APPROVE", overallComment: "Prepared approved manuscript for the invitation example.", submittedAt: new Date() } });
  await db.researchMember.create({ data: { researchId: d.defenseGroups.release.projectId, userId: d.actors.student.id, projectRole: "MEMBER" } });
  d.defenseGroups.decline = { projectId: d.projectId, versionId: latest.id, stageId: pending.stageId };
  await db.taskSubmission.create({ data: { researchId: d.projectId, taskId: eligibilityTask.id, documentId: manuscript.id, documentVersionId: latest.id, submittedBy: baseProject.createdBy, status: "APPROVED", reviewedAt: new Date() } });
  const original = await db.researchProject.findUniqueOrThrow({ where: { id: pending.projectId } });
  const completed = await db.researchProject.create({ data: { researchTypeId: original.researchTypeId, collegeId: original.collegeId, programId: original.programId, academicYearId: original.academicYearId, title: "Prepared Completed Research Defense", groupName: "Completed Defense Example", createdBy: original.createdBy, status: "UNDER_REVIEW", members: { create: [{ userId: original.createdBy, projectRole: "LEADER" }, { userId: d.actors.adviser.id, projectRole: "ADVISER" }] } } });
  const instance = await db.workflowInstance.create({ data: { researchId: completed.id, workflowId: d.workflowId, workflowVersion: 1, currentStageId: pending.stageId } });
  await db.researchProject.update({ where: { id: completed.id }, data: { workflowInstanceId: instance.id } });
  const originalVersion = await db.documentVersion.findUniqueOrThrow({ where: { id: pending.versionId } });
  const task = await db.workflowTask.findFirstOrThrow({ where: { stageId: pending.stageId } });
  const completedDoc = await db.document.create({ data: { researchId: completed.id, milestoneId: pending.stageId, documentType: `TASK_${task.id}`, title: "Approved completed-example manuscript", createdBy: original.createdBy, storageProvider: "LOCAL", lifecycleStatus: "APPROVED" } });
  const completedVersion = await db.documentVersion.create({ data: { documentId: completedDoc.id, versionNumber: 1, fileName: "Completed_Example.pdf", mimeType: "application/pdf", fileSize: originalVersion.fileSize, storagePath: originalVersion.storagePath, uploadedBy: original.createdBy, submittedBy: original.createdBy, submittedAt: new Date(), snapshotCreatedAt: new Date(), milestoneId: pending.stageId, isImmutable: true, manuscriptStatus: "APPROVED", contentChecksum: originalVersion.contentChecksum } });
  const reviewAssignment = await db.reviewerAssignment.create({ data: { researchId: completed.id, documentId: completedDoc.id, documentVersionId: completedVersion.id, reviewerId: d.actors.professor.id, reviewType: "COORDINATOR", assignedById: d.actors.professor.id, status: "COMPLETED", completedAt: new Date(), isRequired: true } });
  await db.review.create({ data: { assignmentId: reviewAssignment.id, documentId: completedDoc.id, documentVersionId: completedVersion.id, reviewerId: d.actors.professor.id, reviewType: "COORDINATOR", status: "SUBMITTED", recommendation: "APPROVE", overallComment: "Prepared approved prerequisite.", submittedAt: new Date() } });
  await db.taskSubmission.create({ data: { researchId: completed.id, taskId: task.id, documentId: completedDoc.id, documentVersionId: completedVersion.id, submittedBy: original.createdBy, status: "APPROVED", reviewedAt: new Date() } });
  d.defenseGroups.completed = { projectId: completed.id, versionId: completedVersion.id, stageId: pending.stageId };
  return { ...d, email: d.actors.panelist.email, password: d.actors.panelist.password, userId: d.actors.panelist.id, pdfTemplateVersionId: version.id };
}
