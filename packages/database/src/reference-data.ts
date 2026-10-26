import type { InstitutionalRole, PrismaClient } from "@prisma/client";
import { upsertVerifiedPrograms } from "./program-catalog.js";

const roles: { name: InstitutionalRole; description: string }[] = [
  { name: "RESEARCHER", description: "Student / Faculty Researcher" },
  { name: "ADVISER", description: "Faculty Research Adviser" },
  { name: "PANELIST", description: "Defense & Proposal Evaluator" },
  {
    name: "RESEARCH_COORDINATOR",
    description: "College / Program Research Coordinator",
  },
  { name: "DEAN", description: "Dean" },

  { name: "SYSTEM_ADMIN", description: "Platform Super Administrator" },
];

const permissions = [
  {
    key: "research.view",
    module: "Research",
    description: "View research projects",
  },
  {
    key: "research.create",
    module: "Research",
    description: "Create research project",
  },
  {
    key: "research.edit",
    module: "Research",
    description: "Edit research project",
  },
  {
    key: "research.submit",
    module: "Research",
    description: "Submit research project for review",
  },
  {
    key: "research.archive",
    module: "Research",
    description: "Archive research project",
  },
  {
    key: "research.assign",
    module: "Research",
    description: "Assign adviser/panelists to research",
  },
  { key: "workflow.view", module: "Workflow", description: "View workflows" },
  {
    key: "workflow.create",
    module: "Workflow",
    description: "Create workflow template",
  },
  {
    key: "workflow.edit",
    module: "Workflow",
    description: "Edit workflow template",
  },
  {
    key: "workflow.publish",
    module: "Workflow",
    description: "Publish workflow version",
  },
  { key: "form.view", module: "Forms", description: "View dynamic forms" },
  {
    key: "form.create",
    module: "Forms",
    description: "Create dynamic form template",
  },
  {
    key: "form.edit",
    module: "Forms",
    description: "Edit dynamic form template",
  },
  { key: "form.submit", module: "Forms", description: "Submit form response" },
  {
    key: "form.approve",
    module: "Forms",
    description: "Approve form response",
  },
  { key: "document.view", module: "Documents", description: "View documents" },
  {
    key: "document.upload",
    module: "Documents",
    description: "Upload document version",
  },
  {
    key: "document.download",
    module: "Documents",
    description: "Download document",
  },
  {
    key: "document.delete",
    module: "Documents",
    description: "Delete document version",
  },
  {
    key: "evaluation.create",
    module: "Evaluation",
    description: "Create evaluation template",
  },
  {
    key: "evaluation.submit",
    module: "Evaluation",
    description: "Submit panelist evaluation",
  },
  {
    key: "calendar.view",
    module: "Calendar",
    description: "View calendar events in scope",
  },
  {
    key: "calendar.create",
    module: "Calendar",
    description: "Create calendar events",
  },
  {
    key: "calendar.edit_own",
    module: "Calendar",
    description: "Edit personally created calendar events",
  },
  {
    key: "calendar.manage",
    module: "Calendar",
    description: "Manage calendar events in scope",
  },
  {
    key: "calendar.availability.manage",
    module: "Calendar",
    description: "Manage personal availability blocks",
  },
  {
    key: "dean.assign",
    module: "DEAN",
    description: "Assign advisers and panelists",
  },
  {
    key: "dean.monitor",
    module: "DEAN",
    description: "Monitor institution-wide research",
  },
  { key: "dean.report", module: "DEAN", description: "Generate DEAN reports" },
  {
    key: "user.manage",
    module: "System",
    description: "Manage users and accounts",
  },
  {
    key: "role.manage",
    module: "System",
    description: "Manage roles and permissions",
  },
  {
    key: "system.configure",
    module: "System",
    description: "Configure system settings",
  },
  {
    key: "audit.view",
    module: "System",
    description: "View audit log entries",
  },
  {
    key: "dashboard.configure",
    module: "System",
    description: "Configure dashboard widgets",
  },
];

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

export async function seedReferenceData(prisma: PrismaClient) {
  for (const role of roles) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: { description: role.description, isSystem: true },
      create: { ...role, isSystem: true },
    });
  }

  for (const permission of permissions) {
    await prisma.permission.upsert({
      where: { key: permission.key },
      update: {
        module: permission.module,
        description: permission.description,
      },
      create: permission,
    });
  }

  for (const [code, name] of institutionalUnits) {
    await prisma.college.upsert({
      where: { code },
      update: { name, isActive: true },
      create: {
        code,
        name,
        description: `${name} academic unit`,
        isActive: true,
      },
    });
  }

  // CIT remains for compatibility with existing institutional data and BSIT.
  await prisma.college.upsert({
    where: { code: "CIT" },
    update: { name: "College of Information Technology", isActive: true },
    create: {
      code: "CIT",
      name: "College of Information Technology",
      description:
        "College managing IT, CS, and IS Capstone & Research projects",
      isActive: true,
    },
  });

  await upsertVerifiedPrograms(prisma);
}
