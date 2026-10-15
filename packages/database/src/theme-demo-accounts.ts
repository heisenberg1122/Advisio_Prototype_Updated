import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { programCatalogKey, upsertVerifiedPrograms, VERIFIED_PROGRAMS } from "./program-catalog.js";

const prisma = new PrismaClient();
const DEMO_EMAIL_PREFIX = "theme-demo.";
const DEMO_EMAIL_SUFFIX = "@university.edu.ph";
const DEMO_ID_PREFIX = "THEME-DEMO-";

function requiredDemoPassword() {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.ALLOW_THEME_DEMO_ACCOUNTS !== "true"
  ) {
    throw new Error(
      "Theme demo accounts are disabled in production. Set ALLOW_THEME_DEMO_ACCOUNTS=true only in an isolated test environment.",
    );
  }

  const password = process.env.DEMO_ACCOUNT_PASSWORD?.trim();
  if (!password || password.length < 12) {
    throw new Error(
      "Set DEMO_ACCOUNT_PASSWORD to at least 12 characters before seeding temporary theme accounts.",
    );
  }
  return password;
}

const demoEmail = (collegeCode: string, programCode: string) =>
  `${DEMO_EMAIL_PREFIX}${collegeCode.toLowerCase()}.${programCode.toLowerCase().replace(/[^a-z0-9]/g, "")}@university.edu.ph`;

const demoUniversityId = (collegeCode: string, programCode: string) =>
  `${DEMO_ID_PREFIX}${collegeCode}-${programCode}`.slice(0, 50);

async function seedThemeDemoAccounts() {
  const demoPassword = requiredDemoPassword();
  const demoPasswordHash = await bcrypt.hash(demoPassword, 12);
  const researcherRole = await prisma.role.findUnique({ where: { name: "RESEARCHER" } });
  if (!researcherRole) throw new Error("The RESEARCHER role is missing. Run npm run db:seed first.");

  const programs = await upsertVerifiedPrograms(prisma);
  const rows: Array<{ college: string; program: string; email: string }> = [];

  for (const offering of VERIFIED_PROGRAMS) {
    const program = programs.get(programCatalogKey(offering.collegeCode, offering.code));
    if (!program) throw new Error(`Program ${offering.code} was not created.`);

    const email = demoEmail(offering.collegeCode, offering.code);
    const universityId = demoUniversityId(offering.collegeCode, offering.code);
    const user = await prisma.user.upsert({
      where: { email },
      update: {
        universityId,
        firstName: "Theme",
        lastName: `${offering.collegeCode} ${offering.code} Demo`,
        passwordHash: demoPasswordHash,
        collegeId: program.collegeId,
        programId: program.id,
        appearancePreference: "SYSTEM",
        status: "ACTIVE",
      },
      create: {
        universityId,
        email,
        firstName: "Theme",
        lastName: `${offering.collegeCode} ${offering.code} Demo`,
        passwordHash: demoPasswordHash,
        collegeId: program.collegeId,
        programId: program.id,
        appearancePreference: "SYSTEM",
        status: "ACTIVE",
      },
    });

    await prisma.userRole.deleteMany({
      where: { userId: user.id, roleId: { not: researcherRole.id } },
    });
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: researcherRole.id } },
      update: {},
      create: { userId: user.id, roleId: researcherRole.id },
    });

    rows.push({ college: offering.collegeCode, program: offering.code, email });
  }

  console.log(`Created or refreshed ${rows.length} temporary college-theme demo accounts.`);
  console.table(rows);
  console.log("All accounts use the configured DEMO_ACCOUNT_PASSWORD; it is not printed.");
  console.log("Remove only these accounts later with: npm run db:demo-themes:cleanup");
}

async function cleanupThemeDemoAccounts() {
  const result = await prisma.user.deleteMany({
    where: {
      OR: [
        { email: { startsWith: DEMO_EMAIL_PREFIX, endsWith: DEMO_EMAIL_SUFFIX } },
        { universityId: { startsWith: DEMO_ID_PREFIX } },
      ],
    },
  });
  console.log(`Removed ${result.count} temporary college-theme demo accounts.`);
  console.log("Verified college and program catalog entries were preserved.");
}

const mode = process.argv[2];
const operation = mode === "cleanup" ? cleanupThemeDemoAccounts : mode === "seed" ? seedThemeDemoAccounts : null;

if (!operation) {
  console.error("Usage: theme-demo-accounts.js <seed|cleanup>");
  process.exitCode = 1;
} else {
  operation()
    .catch((error) => {
      console.error("Theme demo account operation failed:", error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
