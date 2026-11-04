import fs from "node:fs/promises";
import path from "node:path";
import { randomBytes, createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import { PDFDocument, StandardFonts } from "pdf-lib";

export async function seedCoordinator(db, storageRoot) {
  const { seedWorkspace } = await import("../../apps/api/src/evaluation/seed.ts");
  const { EVALUATION_COURSES } = await import("../../apps/api/src/evaluation/catalog.ts");
  const base = await seedWorkspace(db, EVALUATION_COURSES.find((c) => c.id === "BSIT"), "professor", storageRoot);
  const password = `Demo!${randomBytes(10).toString("hex")}9a`, passwordHash = await bcrypt.hash(password, 10);
  const actors = {};
  for (const person of await db.user.findMany()) {
    const email = person.email.replace("@evaluation.invalid", "@example.invalid");
    await db.user.update({ where: { id: person.id }, data: { email, passwordHash } });
    if (["professor", "student", "adviser", "panelist", "dean"].includes(person.email.split("@")[0])) actors[person.email.split("@")[0]] = { id: person.id, email, password };
  }
  const owner = await db.user.findUniqueOrThrow({ where: { id: actors.professor.id } });
  await db.user.update({ where: { id: actors.adviser.id }, data: { maxAdviseeGroups: 20 } });
  const researcherRole = await db.role.findUniqueOrThrow({ where: { name: "RESEARCHER" } });
  const panelRole = await db.role.findUniqueOrThrow({ where: { name: "PANELIST" } });
  const academicYear = await db.academicYear.findFirstOrThrow();
  const workflow = await db.workflow.findFirstOrThrow({ where: { createdBy: owner.id } });
  const topic = await db.workflowTopic.create({ data: { workflowId: workflow.id, title: "Research proposal preparation", sequence: 1 } });
  await db.workflowStage.updateMany({ where: { workflowId: workflow.id }, data: { topicId: topic.id } });
  const lifecycleType = await db.researchType.create({ data: { programId: owner.programId, code: "DEMO-LIFECYCLE", name: "Research Lifecycle Demonstration" } });
  const draft = await db.workflow.create({ data: { researchTypeId: lifecycleType.id, name: "Research Lifecycle Demonstration", description: "Prepared draft for the coordinator walkthrough.", createdBy: owner.id, status: "DRAFT" } });
  const draftTopic = await db.workflowTopic.create({ data: { workflowId: draft.id, title: "Research planning and readiness", sequence: 1 } });
  const stages = {};
  for (const [index, [name, type]] of [["Adviser Selection", "ADVISER_SELECTION"], ["Title Proposal", "TITLE_PROPOSAL"], ["Proposal Manuscript", "STANDARD"], ["Proposal Defense Eligibility", "DEFENSE_ELIGIBILITY"]].entries()) {
    stages[type] = await db.workflowStage.create({ data: { workflowId: draft.id, topicId: draftTopic.id, name, milestoneType: type, sequence: index + 1, responsibleRoleId: researcherRole.id, requiresDocument: type === "STANDARD", requiresApproval: true, category: type === "DEFENSE_ELIGIBILITY" ? "Academic Event" : "Milestone", deadlineDays: type === "STANDARD" ? 14 : null, submissionMode: "GROUP", ...(index ? { requiredMilestoneId: stages[index === 1 ? "ADVISER_SELECTION" : index === 2 ? "TITLE_PROPOSAL" : "STANDARD"].id } : {}) } });
    if (type === "STANDARD") await db.workflowTask.create({ data: { stageId: stages[type].id, title: "Proposal manuscript PDF", sequence: 1, instructions: "Submit the approved proposal manuscript as a PDF. Address adviser feedback before coordinator review.", maxPoints: 100 } });
  }
  async function person(key, firstName, lastName, role = researcherRole) {
    const user = await db.user.create({ data: { firstName, lastName, email: `${key}@example.invalid`, universityId: `DEMO-${key.toUpperCase()}`, passwordHash, collegeId: owner.collegeId, programId: owner.programId, status: "ACTIVE", roles: { create: { roleId: role.id } }, ...(role.name !== "RESEARCHER" ? { collegeMemberships: { create: { collegeId: owner.collegeId, roleNames: [role.name] } }, facultyProfile: { create: { academicTitle: "Faculty Member", department: "Information Technology" } } } : {}) } });
    if (role.name === "RESEARCHER") await db.researcherProfile.create({ data: { userId: user.id, academicYearId: academicYear.id, degreeLevel: "UNDERGRADUATE", yearLevel: "YEAR_4", academicTerm: "FIRST_SEMESTER", researchStatus: "NO_PROJECT", groupSetup: "INDIVIDUAL", researchType: "INDIVIDUAL", status: "SUBMITTED", submittedAt: new Date() } });
    actors[key] = { id: user.id, email: user.email, password }; return user;
  }
  await person("joiner", "Nina", "Mercado"); await person("invitee", "Owen", "Ramos");
  const chair = await person("chair", "Rafael", "Dizon", panelRole);
  const adviserLeader = await person("adviser-leader", "Keira", "Navarro");
  const titleLeader = await person("title-leader", "Liam", "Rivera");
  const participation = async (leader, name, stageId) => {
    await db.workflowEnrollment.create({ data: { workflowId: draft.id, userId: leader.id } });
    const project = await db.researchProject.create({ data: { researchTypeId: lifecycleType.id, collegeId: owner.collegeId, programId: owner.programId, academicYearId: academicYear.id, groupName: name, title: "Research title not registered", workflowDraft: true, createdBy: leader.id, members: { create: { userId: leader.id, projectRole: "LEADER" } } } });
    const instance = await db.workflowInstance.create({ data: { researchId: project.id, workflowId: draft.id, workflowVersion: 1, currentStageId: stageId } });
    await db.researchProject.update({ where: { id: project.id }, data: { workflowInstanceId: instance.id } }); return project;
  };
  const adviserProject = await participation(adviserLeader, "Research Group D", stages.ADVISER_SELECTION.id);
  const titleProject = await participation(titleLeader, "Research Group E", stages.TITLE_PROPOSAL.id);
  await db.researchMember.create({ data: { researchId: titleProject.id, userId: actors.adviser.id, projectRole: "ADVISER" } });
  await db.adviserRequest.create({ data: { researchId: titleProject.id, requestedById: titleLeader.id, adviserId: actors.adviser.id, workflowStageId: stages.ADVISER_SELECTION.id, status: "ACCEPTED", respondedAt: new Date(), note: "Accepted adviser assignment in the prepared example." } });
  const defenseTopic = await db.workflowTopic.create({ data: { workflowId: workflow.id, title: "Proposal defense readiness", sequence: 2 } });
  const last = await db.workflowStage.findFirstOrThrow({ where: { workflowId: workflow.id }, orderBy: { sequence: "desc" } });
  const eligibilityStage = await db.workflowStage.create({ data: { workflowId: workflow.id, topicId: defenseTopic.id, name: "Proposal Defense Eligibility", milestoneType: "DEFENSE_ELIGIBILITY", category: "Academic Event", sequence: last.sequence + 1, responsibleRoleId: researcherRole.id, requiresDocument: true, requiresApproval: true, submissionMode: "GROUP" } });
  const defenseTask = await db.workflowTask.create({ data: { stageId: eligibilityStage.id, title: "Approved proposal for defense", sequence: 1, isRequired: true } });
  async function pdf(title, lines) {
    const document = await PDFDocument.create(), font = await document.embedFont(StandardFonts.Helvetica), bold = await document.embedFont(StandardFonts.HelveticaBold), page = document.addPage([595, 842]);
    page.drawText("ADVISIO | Fictional demonstration record", { x: 48, y: 792, size: 10, font }); page.drawText(title, { x: 48, y: 750, size: 17, font: bold }); let y = 708;
    for (const text of lines) { let row = ""; for (const word of text.split(/\s+/)) { if (font.widthOfTextAtSize(`${row} ${word}`, 11) > 490) { page.drawText(row, { x: 48, y, size: 11, font }); y -= 18; row = word; } else row += `${row ? " " : ""}${word}`; } page.drawText(row, { x: 48, y, size: 11, font }); y -= 32; }
    page.drawText("Prepared for product orientation. No real academic decision is represented.", { x: 48, y: 32, size: 9, font }); return Buffer.from(await document.save());
  }
  const projects = await db.researchProject.findMany({ where: { workflowDraft: false }, orderBy: { groupName: "asc" } });
  for (const version of await db.documentVersion.findMany({ include: { document: true } })) {
    const project = projects.find((p) => p.id === version.document.researchId);
    const bytes = await pdf("Research proposal", [project.title, `Submitted manuscript - Version ${version.versionNumber}`, "Purpose: Document campus research requirements and planned outputs.", "Method: Review the relevant requirements and document the proposed approach.", "Review focus: Align the research objectives, scope, and supporting evidence."]);
    await fs.writeFile(version.storagePath, bytes); await db.documentVersion.update({ where: { id: version.id }, data: { fileSize: BigInt(bytes.length), contentChecksum: createHash("sha256").update(bytes).digest("hex"), snapshotCreatedAt: new Date(), googleDriveFileId: null } });
  }
  // Three independent, clearly labelled prepared defense scenarios. No active
  // session is silently advanced by the recorder or by an animation.
  const defenseGroups = {};
  for (const [index, label] of ["readiness", "schedule", "release"].entries()) {
    const leader = await person(`defense-${label}`, ["Elena", "Marco", "Sofia"][index], ["Cruz", "Torres", "Reyes"][index]);
    await db.workflowEnrollment.create({ data: { workflowId: workflow.id, userId: leader.id } });
    const project = await db.researchProject.create({ data: { researchTypeId: workflow.researchTypeId, collegeId: owner.collegeId, programId: owner.programId, academicYearId: academicYear.id, title: ["Campus Accessibility Requirements Study", "Library Resource Tracking Prototype", "Student Research Support Portal"][index], groupName: `Defense Group ${index + 1}`, createdBy: leader.id, status: "UNDER_REVIEW", members: { create: [{ userId: leader.id, projectRole: "LEADER" }, { userId: actors.adviser.id, projectRole: "ADVISER" }] } } });
    const instance = await db.workflowInstance.create({ data: { researchId: project.id, workflowId: workflow.id, workflowVersion: 1, currentStageId: eligibilityStage.id } });
    await db.researchProject.update({ where: { id: project.id }, data: { workflowInstanceId: instance.id } });
    const bytes = await pdf("Approved defense manuscript", [project.title, "The proposal scope, research objectives, and proposed method have been reviewed.", "This fictional submitted copy is ready for the configured defense eligibility review."]);
    const storagePath = path.join(storageRoot, `${label}-manuscript.pdf`); await fs.writeFile(storagePath, bytes);
    const document = await db.document.create({ data: { researchId: project.id, milestoneId: eligibilityStage.id, title: "Approved proposal manuscript", documentType: `TASK_${defenseTask.id}`, createdBy: leader.id, lifecycleStatus: "APPROVED", storageProvider: "LOCAL" } });
    const version = await db.documentVersion.create({ data: { documentId: document.id, versionNumber: 1, fileName: `${label}-proposal.pdf`, mimeType: "application/pdf", fileSize: BigInt(bytes.length), storagePath, uploadedBy: leader.id, submittedBy: leader.id, submittedAt: new Date(), snapshotCreatedAt: new Date(), milestoneId: eligibilityStage.id, isImmutable: true, manuscriptStatus: "APPROVED", contentChecksum: createHash("sha256").update(bytes).digest("hex") } });
    const assignment = await db.reviewerAssignment.create({ data: { researchId: project.id, documentId: document.id, documentVersionId: version.id, reviewerId: owner.id, reviewType: "COORDINATOR", assignedById: owner.id, status: "COMPLETED", completedAt: new Date(), isRequired: true } });
    await db.review.create({ data: { assignmentId: assignment.id, documentId: document.id, documentVersionId: version.id, reviewerId: owner.id, reviewType: "COORDINATOR", status: "SUBMITTED", recommendation: "APPROVE", overallComment: "The prepared manuscript satisfies the demonstration requirements.", submittedAt: new Date() } });
    const submission = await db.taskSubmission.create({ data: { researchId: project.id, taskId: defenseTask.id, documentId: document.id, documentVersionId: version.id, submittedBy: leader.id, status: "APPROVED", reviewedAt: new Date(), reviewNote: "Prepared approved prerequisite." } });
    await db.taskSubmissionAttempt.create({ data: { taskSubmissionId: submission.id, taskId: defenseTask.id, researchId: project.id, milestoneId: eligibilityStage.id, documentId: document.id, documentVersionId: version.id, submittedBy: leader.id, attemptNumber: 1 } });
    defenseGroups[label] = { projectId: project.id, versionId: version.id, stageId: eligibilityStage.id, leaderId: leader.id };
  }
  const samplePdf = path.join(storageRoot, "Research_Guide.pdf"); await fs.writeFile(samplePdf, await pdf("Research preparation guide", ["1. Join the coordinator's workflow and await access approval.", "2. Follow the configured adviser, title, and manuscript milestones.", "3. Complete defense eligibility before requesting a Dean signature.", "4. Review the released academic results and required next steps."]));
  const letterPdf = path.join(storageRoot, "Dean_Approval_Request.pdf"); await fs.writeFile(letterPdf, await pdf("Proposal defense approval request", ["To the College Dean: Please review the prepared proposal defense eligibility record.", "The coordinator has verified the required submissions for this demonstration group.", "Please review the attached request before applying your signature."]));
  return { email: actors.professor.email, password, userId: owner.id, actors, workflowId: workflow.id, draftWorkflowId: draft.id, programId: owner.programId, academicYearId: academicYear.id, projectId: base.projectId, adviserProjectId: adviserProject.id, titleProjectId: titleProject.id, stages: Object.fromEntries(Object.entries(stages).map(([key, value]) => [key, value.id])), defenseGroups, samplePdf, letterPdf, chairId: chair.id, collegeId: owner.collegeId };
}
