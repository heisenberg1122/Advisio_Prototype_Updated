import { prisma } from "../lib/prisma.js";
import { assertIsolatedIntegrationDatabase } from "./database-integration.js";

async function countKnownFixtureRoots(): Promise<Record<string, number>> {
  const [
    colleges,
    programs,
    academicYears,
    users,
    researchTypes,
    workflows,
    projects,
  ] = await Promise.all([
    prisma.college.count({
      where: {
        OR: [
          {
            name: {
              in: ["Phase 3 Isolated College", "Phase 4 Isolated College"],
            },
          },
          { name: { startsWith: "Faculty Profile Adviser College " } },
          { name: { startsWith: "Faculty Profile Other College " } },
        ],
      },
    }),
    prisma.program.count({
      where: {
        OR: [
          {
            name: {
              in: ["Phase 3 Isolated Program", "Phase 4 Isolated Program"],
            },
          },
          { name: { startsWith: "Faculty Profile Adviser Program " } },
          { name: { startsWith: "Faculty Profile Other Program " } },
        ],
      },
    }),
    prisma.academicYear.count({
      where: {
        OR: [{ name: { startsWith: "P3-" } }, { name: { startsWith: "P4-" } }],
      },
    }),
    prisma.user.count({
      where: {
        OR: [
          { email: { endsWith: "@isolated.test" } },
          { email: { endsWith: "@integration.test" } },
        ],
      },
    }),
    prisma.researchType.count({
      where: {
        OR: [
          { code: { startsWith: "P3-MANUSCRIPT-" } },
          { code: { startsWith: "P4-MANUSCRIPT-" } },
        ],
      },
    }),
    prisma.workflow.count({
      where: {
        name: {
          in: [
            "Phase 3 Verification Workflow",
            "Phase 4 Verification Workflow",
          ],
        },
      },
    }),
    prisma.researchProject.count({
      where: {
        title: {
          in: [
            "Isolated immutable manuscript verification",
            "Separate project eligibility boundary",
            "Phase 4 isolated review verification",
          ],
        },
      },
    }),
  ]);

  return {
    colleges,
    programs,
    academicYears,
    users,
    researchTypes,
    workflows,
    projects,
  };
}

async function main(): Promise<void> {
  const identity = await assertIsolatedIntegrationDatabase(prisma);
  console.log(
    `Verified live integration database "${identity.databaseName}" as user "${identity.databaseUser}" on schema "${identity.schemaName}".`,
  );

  if (process.argv.includes("--assert-clean")) {
    const counts = await countKnownFixtureRoots();
    const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
    if (total > 0) {
      throw new Error(
        `The integration database contains ${total} known fixture root record(s): ${JSON.stringify(counts)}. Refusing to continue without a reviewed cleanup.`,
      );
    }
    console.log("Verified that known integration fixture roots are absent.");
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
