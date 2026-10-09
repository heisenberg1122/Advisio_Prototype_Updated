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
    // Calendar
    { key: "calendar.view", module: "Calendar", description: "View calendar events in scope" },
    { key: "calendar.create", module: "Calendar", description: "Create calendar events" },
    { key: "calendar.edit_own", module: "Calendar", description: "Edit personally created calendar events" },
    { key: "calendar.manage", module: "Calendar", description: "Manage calendar events in scope" },
    { key: "calendar.availability.manage", module: "Calendar", description: "Manage personal availability blocks" },
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

  // 3. Organization Seed: institutional colleges and schools
  console.log("Seeding institutional colleges and schools...");
  const institutionalUnits = [
    ["COA", "College of Accountancy"],
    ["CEA", "College of Engineering and Architecture"],
    ["CHTM", "College of Hospitality and Tourism Management"],
    ["CNP", "College of Nursing and Pharmacy"],
    ["SAS", "School of Arts and Sciences"],
    ["SBPA", "School of Business and Public Administration"],
    ["SOE", "School of Education"],
    ["SHS", "Senior High School"],
  ] as const;

  for (const [code, name] of institutionalUnits) {
    await prisma.college.upsert({
      where: { code },
      update: { name, isActive: true },
      create: { code, name, description: `${name} academic unit` },
    });
  }

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

  // The workflow owner must exist before the workflow so notification recipients
  // and the workflow creator foreign key always reference a real professor.
  const workflowOwner = await prisma.user.upsert({
    where: { email: "professor01@university.edu.ph" },
    update: { status: "ACTIVE", collegeId: cit.id, programId: bsit.id },
    create: {
      universityId: "PROFESSOR-DEMO-001",
      email: "professor01@university.edu.ph",
      firstName: "Maria Clara",
      lastName: "Santos",
      passwordHash: "$2b$10$w/lINNxlnWGkbSqJY8M/A.Dz/W7RmRPILC8/lyoAk4K7iuwGYi/KS",
      status: "ACTIVE",
      collegeId: cit.id,
      programId: bsit.id,
    },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: workflowOwner.id, roleId: rolesMap["RESEARCH_COORDINATOR"] } },
    update: {},
    create: { userId: workflowOwner.id, roleId: rolesMap["RESEARCH_COORDINATOR"] },
  });

  const capstoneWorkflow = await prisma.workflow.upsert({
    where: { researchTypeId_version: { researchTypeId: capstoneType.id, version: 1 } },
    update: { name: "BSIT Capstone Standard Workflow", createdBy: workflowOwner.id },
    create: {
      researchTypeId: capstoneType.id,
      name: "BSIT Capstone Standard Workflow",
      description: "7-stage workflow for BSIT Capstone projects",
      version: 1,
      status: "PUBLISHED",
      createdBy: workflowOwner.id,
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

  // 5. Bootstrap initial accounts and the demo accounts advertised by the login page
  console.log("Seeding Core Initial User Accounts...");
  const initialUsers = [
    {
      universityId: "STUDENT-DEMO-001",
      email: "student01@university.edu.ph",
      firstName: "Student",
      lastName: "Researcher",
      passwordHash: "$2b$10$w/lINNxlnWGkbSqJY8M/A.Dz/W7RmRPILC8/lyoAk4K7iuwGYi/KS", // password123
      roleName: "RESEARCHER",
    },
    {
      universityId: "ADVISER-DEMO-001",
      email: "adviser01@university.edu.ph",
      firstName: "Faculty",
      lastName: "Adviser",
      passwordHash: "$2b$10$w/lINNxlnWGkbSqJY8M/A.Dz/W7RmRPILC8/lyoAk4K7iuwGYi/KS", // password123
      roleName: "ADVISER",
    },
    {
      universityId: "PROFESSOR-DEMO-001",
      email: "professor01@university.edu.ph",
      firstName: "Maria Clara",
      lastName: "Santos",
      passwordHash: "$2b$10$w/lINNxlnWGkbSqJY8M/A.Dz/W7RmRPILC8/lyoAk4K7iuwGYi/KS", // password123
      roleName: "RESEARCH_COORDINATOR",
    },
    {
      universityId: "PROFESSOR-DEMO-002",
      email: "professor02@university.edu.ph",
      firstName: "Arthur",
      lastName: "Pendelton",
      passwordHash: "$2b$10$w/lINNxlnWGkbSqJY8M/A.Dz/W7RmRPILC8/lyoAk4K7iuwGYi/KS", // password123
      roleName: "RESEARCH_COORDINATOR",
    },
    {
      universityId: "PROFESSOR-DEMO-003",
      email: "professor03@university.edu.ph",
      firstName: "Elena",
      lastName: "Rostova",
      passwordHash: "$2b$10$w/lINNxlnWGkbSqJY8M/A.Dz/W7RmRPILC8/lyoAk4K7iuwGYi/KS", // password123
      roleName: "RESEARCH_COORDINATOR",
    },
    {
      universityId: "PROFESSOR-DEMO-004",
      email: "professor04@university.edu.ph",
      firstName: "Marcus",
      lastName: "Vance",
      passwordHash: "$2b$10$w/lINNxlnWGkbSqJY8M/A.Dz/W7RmRPILC8/lyoAk4K7iuwGYi/KS", // password123
      roleName: "RESEARCH_COORDINATOR",
    },
    {
      universityId: "PROFESSOR-DEMO-005",
      email: "professor05@university.edu.ph",
      firstName: "Sophia",
      lastName: "Delgado",
      passwordHash: "$2b$10$w/lINNxlnWGkbSqJY8M/A.Dz/W7RmRPILC8/lyoAk4K7iuwGYi/KS", // password123
      roleName: "RESEARCH_COORDINATOR",
    },
    {
      universityId: "PANELIST-DEMO-001",
      email: "panelist01@university.edu.ph",
      firstName: "Defense",
      lastName: "Panelist",
      passwordHash: "$2b$10$w/lINNxlnWGkbSqJY8M/A.Dz/W7RmRPILC8/lyoAk4K7iuwGYi/KS", // password123
      roleName: "PANELIST",
    },
    {
      universityId: "PANELIST-DEMO-002",
      email: "panelist02@university.edu.ph",
      firstName: "Dr. Fernando",
      lastName: "Gomez",
      passwordHash: "$2b$10$w/lINNxlnWGkbSqJY8M/A.Dz/W7RmRPILC8/lyoAk4K7iuwGYi/KS", // password123
      roleName: "PANELIST",
    },
    {
      universityId: "PANELIST-DEMO-003",
      email: "panelist03@university.edu.ph",
      firstName: "Prof. Lilian",
      lastName: "Morales",
      passwordHash: "$2b$10$w/lINNxlnWGkbSqJY8M/A.Dz/W7RmRPILC8/lyoAk4K7iuwGYi/KS", // password123
      roleName: "PANELIST",
    },
    {
      universityId: "PANELIST-DEMO-004",
      email: "panelist04@university.edu.ph",
      firstName: "Dr. Eduardo",
      lastName: "Castillo",
      passwordHash: "$2b$10$w/lINNxlnWGkbSqJY8M/A.Dz/W7RmRPILC8/lyoAk4K7iuwGYi/KS", // password123
      roleName: "PANELIST",
    },
    {
      universityId: "PANELIST-DEMO-005",
      email: "panelist05@university.edu.ph",
      firstName: "Prof. Victoria",
      lastName: "Navarro",
      passwordHash: "$2b$10$w/lINNxlnWGkbSqJY8M/A.Dz/W7RmRPILC8/lyoAk4K7iuwGYi/KS", // password123
      roleName: "PANELIST",
    },
    {
      universityId: "ADVISER-DEMO-002",
      email: "adviser02@university.edu.ph",
      firstName: "Dr. Ramon",
      lastName: "Bautista",
      passwordHash: "$2b$10$w/lINNxlnWGkbSqJY8M/A.Dz/W7RmRPILC8/lyoAk4K7iuwGYi/KS", // password123
      roleName: "ADVISER",
    },
    {
      universityId: "ADVISER-DEMO-003",
      email: "adviser03@university.edu.ph",
      firstName: "Prof. Teresa",
      lastName: "Mercado",
      passwordHash: "$2b$10$w/lINNxlnWGkbSqJY8M/A.Dz/W7RmRPILC8/lyoAk4K7iuwGYi/KS", // password123
      roleName: "ADVISER",
    },
    {
      universityId: "ADVISER-DEMO-004",
      email: "adviser04@university.edu.ph",
      firstName: "Dr. Antonio",
      lastName: "Villanueva",
      passwordHash: "$2b$10$w/lINNxlnWGkbSqJY8M/A.Dz/W7RmRPILC8/lyoAk4K7iuwGYi/KS", // password123
      roleName: "ADVISER",
    },
    {
      universityId: "ADVISER-DEMO-005",
      email: "adviser05@university.edu.ph",
      firstName: "Prof. Carmen",
      lastName: "Salazar",
      passwordHash: "$2b$10$w/lINNxlnWGkbSqJY8M/A.Dz/W7RmRPILC8/lyoAk4K7iuwGYi/KS", // password123
      roleName: "ADVISER",
    },
    {
      universityId: "STUDENT-DEMO-002",
      email: "student02@university.edu.ph",
      firstName: "Mateo",
      lastName: "Alvarez",
      passwordHash: "$2b$10$w/lINNxlnWGkbSqJY8M/A.Dz/W7RmRPILC8/lyoAk4K7iuwGYi/KS", // password123
      roleName: "RESEARCHER",
    },
    {
      universityId: "STUDENT-DEMO-003",
      email: "student03@university.edu.ph",
      firstName: "Beatrice",
      lastName: "Cruz",
      passwordHash: "$2b$10$w/lINNxlnWGkbSqJY8M/A.Dz/W7RmRPILC8/lyoAk4K7iuwGYi/KS", // password123
      roleName: "RESEARCHER",
    },
    {
      universityId: "STUDENT-DEMO-004",
      email: "student04@university.edu.ph",
      firstName: "Gabriel",
      lastName: "Santos",
      passwordHash: "$2b$10$w/lINNxlnWGkbSqJY8M/A.Dz/W7RmRPILC8/lyoAk4K7iuwGYi/KS", // password123
      roleName: "RESEARCHER",
    },
    {
      universityId: "STUDENT-DEMO-005",
      email: "student05@university.edu.ph",
      firstName: "Alyssa",
      lastName: "Dizon",
      passwordHash: "$2b$10$w/lINNxlnWGkbSqJY8M/A.Dz/W7RmRPILC8/lyoAk4K7iuwGYi/KS", // password123
      roleName: "RESEARCHER",
    },
    {
      universityId: "RES-DEMO-001",
      email: "researcher01@university.edu.ph",
      firstName: "Carlos",
      lastName: "Mendoza",
      passwordHash: "$2b$10$w/lINNxlnWGkbSqJY8M/A.Dz/W7RmRPILC8/lyoAk4K7iuwGYi/KS", // password123
      roleName: "RESEARCHER",
    },
    {
      universityId: "RES-DEMO-002",
      email: "researcher02@university.edu.ph",
      firstName: "Patricia",
      lastName: "Reyes",
      passwordHash: "$2b$10$w/lINNxlnWGkbSqJY8M/A.Dz/W7RmRPILC8/lyoAk4K7iuwGYi/KS", // password123
      roleName: "RESEARCHER",
    },
    {
      universityId: "DEAN-DEMO-001",
      email: "dean01@university.edu.ph",
      firstName: "Dr. Manuel",
      lastName: "Soriano",
      passwordHash: "$2b$10$w/lINNxlnWGkbSqJY8M/A.Dz/W7RmRPILC8/lyoAk4K7iuwGYi/KS", // password123
      roleName: "RPO",
    },
    {
      universityId: "DEAN-DEMO-002",
      email: "dean.cit@university.edu.ph",
      firstName: "Dr. Angelica",
      lastName: "Flores",
      passwordHash: "$2b$10$w/lINNxlnWGkbSqJY8M/A.Dz/W7RmRPILC8/lyoAk4K7iuwGYi/KS", // password123
      roleName: "RPO",
    },
    {
      universityId: "DEAN-001",
      email: "dean@advisio.edu.ph",
      firstName: "Dr. Ernesto",
      lastName: "Valerio",
      passwordHash: "$2b$10$w/lINNxlnWGkbSqJY8M/A.Dz/W7RmRPILC8/lyoAk4K7iuwGYi/KS", // password123
      roleName: "RPO",
    },
    {
      universityId: "ADMIN-001",
      email: "admin01@university.edu.ph",
      firstName: "Admin",
      lastName: "Officer",
      passwordHash: "$2b$10$w/lINNxlnWGkbSqJY8M/A.Dz/W7RmRPILC8/lyoAk4K7iuwGYi/KS", // password123
      roleName: "RPO",
    },
    {
      universityId: "SYSADMIN-001",
      email: "superadmin01@university.edu.ph",
      firstName: "System",
      lastName: "Administrator",
      passwordHash: "$2b$10$w/lINNxlnWGkbSqJY8M/A.Dz/W7RmRPILC8/lyoAk4K7iuwGYi/KS", // password123
      roleName: "SYSTEM_ADMIN",
    },
    {
      universityId: "SYSADMIN-002",
      email: "admin@advisio.edu.ph",
      firstName: "System",
      lastName: "Administrator",
      passwordHash: "$2b$10$uciAmngb6Ztr3vbzoL6o1uVgFpDcpflshI8Q41QQFjY8ackpOMsgW", // Admin@12345
      roleName: "SYSTEM_ADMIN",
    },
    {
      universityId: "ADVISER-001",
      email: "adviser@advisio.edu.ph",
      firstName: "Rachel",
      lastName: "Lim",
      passwordHash: "$2b$10$BbiQOmLIW0ipJR7m25KE7.H4MUNz5aah/F4MBnyiUcx.LRdO9O78i", // Adviser@12345
      roleName: "ADVISER",
    },
    {
      universityId: "STUDENT-001",
      email: "student@advisio.edu.ph",
      firstName: "Juan",
      lastName: "Reyes",
      passwordHash: "$2b$10$zCmHCBBl4OrmXMc2Ed6Rz.RAyvM6o0pI6KQ6j592uOx/AFr4yO6Wq", // Student@12345
      roleName: "RESEARCHER",
    },
  ];

  for (const u of initialUsers) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {
        universityId: u.universityId,
        firstName: u.firstName,
        lastName: u.lastName,
        passwordHash: u.passwordHash,
        status: "ACTIVE",
        collegeId: cit.id,
        programId: bsit.id,
      },
      create: {
        universityId: u.universityId,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        passwordHash: u.passwordHash,
        status: "ACTIVE",
        collegeId: cit.id,
        programId: bsit.id,
      },
    });

    const roleId = rolesMap[u.roleName];
    if (roleId) {
      // Demo accounts have one deterministic primary role so dashboard routing is stable.
      await prisma.userRole.deleteMany({
        where: { userId: user.id, roleId: { not: roleId } },
      });
      await prisma.userRole.upsert({
        where: {
          userId_roleId: {
            userId: user.id,
            roleId: roleId,
          },
        },
        update: {},
        create: {
          userId: user.id,
          roleId: roleId,
        },
      });
    }
  }

  console.log("✅ Seed completed successfully! Admin: admin01@university.edu.ph / password123");
  console.log("   System admin: superadmin01@university.edu.ph / password123");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
