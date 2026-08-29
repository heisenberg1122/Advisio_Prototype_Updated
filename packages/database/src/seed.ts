import { PrismaClient, InstitutionalRole } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting seed...");

  // 1. Institutional Roles
  console.log("Creating Institutional Roles...");
  const rolesData: { name: InstitutionalRole; description: string }[] = [
    { name: "RESEARCHER", description: "Student / Faculty Researcher" },
    { name: "ADVISER", description: "Faculty Research Adviser" },
    { name: "PANELIST", description: "Defense & Proposal Evaluator" },
    { name: "RESEARCH_COORDINATOR", description: "College / Program Research Coordinator" },
    { name: "RPO", description: "Research & Publications Office Staff" },
    { name: "REB", description: "Research Ethics Board Reviewer / Admin" },
    { name: "VPAA", description: "Vice President for Academic Affairs / Institutional Exec" },
    { name: "SYSTEM_ADMIN", description: "Platform Super Administrator" },
  ];

  const rolesMap: Record<string, string> = {};
  for (const r of rolesData) {
    const role = await prisma.role.upsert({
      where: { name: r.name },
      update: { description: r.description },
      create: { name: r.name, description: r.description, isSystem: true },
    });
    rolesMap[r.name] = role.id;
  }

  // 2. Base Permissions Matrix
  console.log("Creating Base Permissions...");
  const permissionsList = [
    // Research
    { key: "research.view", module: "Research", description: "View research projects" },
    { key: "research.create", module: "Research", description: "Create research project" },
    { key: "research.edit", module: "Research", description: "Edit research project" },
    { key: "research.submit", module: "Research", description: "Submit research project for review" },
    { key: "research.archive", module: "Research", description: "Archive research project" },
    { key: "research.assign", module: "Research", description: "Assign adviser/panelists to research" },
    // Workflow
    { key: "workflow.view", module: "Workflow", description: "View workflows" },
    { key: "workflow.create", module: "Workflow", description: "Create workflow template" },
    { key: "workflow.edit", module: "Workflow", description: "Edit workflow template" },
    { key: "workflow.publish", module: "Workflow", description: "Publish workflow version" },
    // Forms
    { key: "form.view", module: "Forms", description: "View dynamic forms" },
    { key: "form.create", module: "Forms", description: "Create dynamic form template" },
    { key: "form.edit", module: "Forms", description: "Edit dynamic form template" },
    { key: "form.submit", module: "Forms", description: "Submit form response" },
    { key: "form.approve", module: "Forms", description: "Approve form response" },
    // Documents
    { key: "document.view", module: "Documents", description: "View documents" },
    { key: "document.upload", module: "Documents", description: "Upload document version" },
    { key: "document.download", module: "Documents", description: "Download document" },
    { key: "document.delete", module: "Documents", description: "Delete document version" },
    // Evaluation
    { key: "evaluation.create", module: "Evaluation", description: "Create evaluation template" },
    { key: "evaluation.submit", module: "Evaluation", description: "Submit panelist evaluation" },
    // REB
    { key: "reb.review", module: "REB", description: "Review REB applications" },
    { key: "reb.approve", module: "REB", description: "Approve REB application" },
    { key: "reb.reject", module: "REB", description: "Reject REB application" },
    { key: "reb.request_revision", module: "REB", description: "Request REB revision" },
    { key: "reb.issue_certificate", module: "REB", description: "Issue REB clearance certificate" },
    // RPO
    { key: "rpo.assign", module: "RPO", description: "Assign advisers and panelists" },
    { key: "rpo.monitor", module: "RPO", description: "Monitor institution-wide research" },
    { key: "rpo.report", module: "RPO", description: "Generate RPO reports" },
    // VPAA
    { key: "vpaa.view", module: "VPAA", description: "View executive statistics" },
    { key: "vpaa.approve", module: "VPAA", description: "Institutional high-level approval" },
    // System & Admin
    { key: "user.manage", module: "System", description: "Manage users and accounts" },
    { key: "role.manage", module: "System", description: "Manage roles and permissions" },
    { key: "system.configure", module: "System", description: "Configure system settings" },
    { key: "audit.view", module: "System", description: "View audit log entries" },
    { key: "dashboard.configure", module: "System", description: "Configure dashboard widgets" },
  ];

  for (const p of permissionsList) {
    await prisma.permission.upsert({
      where: { key: p.key },
      update: { module: p.module, description: p.description },
      create: p,
    });
  }

  // 3. Organization Seed: CIT & BSIT
  console.log("Seeding sample Organization (CIT / BSIT)...");
  const cit = await prisma.college.upsert({
    where: { code: "CIT" },
    update: { name: "College of Information Technology" },
    create: {
      code: "CIT",
      name: "College of Information Technology",
      description: "College managing IT, CS, and IS Capstone & Research projects",
    },
  });

  const bsit = await prisma.program.upsert({
    where: { collegeId_code: { collegeId: cit.id, code: "BSIT" } },
    update: { name: "Bachelor of Science in Information Technology" },
    create: {
      collegeId: cit.id,
      code: "BSIT",
      name: "Bachelor of Science in Information Technology",
      description: "BSIT Undergraduate Degree Program",
    },
  });

  const ay2526 = await prisma.academicYear.upsert({
    where: { name: "2025-2026" },
    update: { isCurrent: true },
    create: {
      name: "2025-2026",
      startDate: new Date("2025-08-01"),
      endDate: new Date("2026-06-30"),
      isCurrent: true,
    },
  });

  // 4. Sample Research Type & Workflow
  console.log("Seeding Sample Workflow Configuration...");
  const capstoneType = await prisma.researchType.upsert({
    where: { programId_code: { programId: bsit.id, code: "CAPSTONE" } },
    update: { name: "Capstone Project" },
    create: {
      programId: bsit.id,
      code: "CAPSTONE",
      name: "Capstone Project",
      description: "BSIT Final Capstone Design & Implementation Project",
    },
  });

  const capstoneWorkflow = await prisma.workflow.upsert({
    where: { researchTypeId_version: { researchTypeId: capstoneType.id, version: 1 } },
    update: { name: "BSIT Capstone Standard Workflow" },
    create: {
      researchTypeId: capstoneType.id,
      name: "BSIT Capstone Standard Workflow",
      description: "7-stage workflow for BSIT Capstone projects",
      version: 1,
      status: "PUBLISHED",
      createdBy: "00000000-0000-0000-0000-000000000000",
      publishedAt: new Date(),
    },
  });

  // Attach workflow back to research type
  await prisma.researchType.update({
    where: { id: capstoneType.id },
    data: { workflowId: capstoneWorkflow.id },
  });

  // Stages for BSIT Capstone
  const stagesData = [
    { sequence: 1, name: "Topic Proposal", responsibleRoleId: rolesMap["RESEARCHER"], requiresApproval: true },
    { sequence: 2, name: "Adviser Review & Endorsement", responsibleRoleId: rolesMap["ADVISER"], requiresApproval: true },
    { sequence: 3, name: "Proposal Defense", responsibleRoleId: rolesMap["PANELIST"], requiresApproval: true },
    { sequence: 4, name: "REB Ethics Evaluation", responsibleRoleId: rolesMap["REB"], requiresApproval: true },
    { sequence: 5, name: "Implementation & Manuscript Revision", responsibleRoleId: rolesMap["RESEARCHER"], requiresApproval: false },
    { sequence: 6, name: "Final Oral Defense", responsibleRoleId: rolesMap["PANELIST"], requiresApproval: true },
    { sequence: 7, name: "Final Manuscript Approval & Archiving", responsibleRoleId: rolesMap["RPO"], requiresApproval: true, isFinal: true },
  ];

  for (const s of stagesData) {
    await prisma.workflowStage.upsert({
      where: { workflowId_sequence: { workflowId: capstoneWorkflow.id, sequence: s.sequence } },
      update: { name: s.name, responsibleRoleId: s.responsibleRoleId },
      create: {
        workflowId: capstoneWorkflow.id,
        sequence: s.sequence,
        name: s.name,
        responsibleRoleId: s.responsibleRoleId,
        requiresApproval: s.requiresApproval,
        isFinal: s.isFinal || false,
      },
    });
  }

  console.log("✅ Seed completed successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
