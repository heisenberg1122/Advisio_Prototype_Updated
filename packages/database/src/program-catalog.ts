import type { PrismaClient, Program } from "@prisma/client";

/**
 * Verified University of the Assumption offerings used by registration.
 * Source: UA college enrollment materials for AY 2026-2027.
 */
export const VERIFIED_PROGRAMS = [
  {
    collegeCode: "COA",
    code: "BSA",
    name: "Bachelor of Science in Accountancy",
  },
  {
    collegeCode: "COA",
    code: "BSAIS",
    name: "Bachelor of Science in Accounting Information System",
  },
  {
    collegeCode: "CEA",
    code: "BSARCH",
    name: "Bachelor of Science in Architecture",
  },
  {
    collegeCode: "CEA",
    code: "BSCE",
    name: "Bachelor of Science in Civil Engineering",
  },
  {
    collegeCode: "CEA",
    code: "BSCPE",
    name: "Bachelor of Science in Computer Engineering",
  },
  {
    collegeCode: "CEA",
    code: "BSIE",
    name: "Bachelor of Science in Industrial Engineering",
  },
  {
    collegeCode: "CHTM",
    code: "BSHM",
    name: "Bachelor of Science in Hospitality Management",
  },
  {
    collegeCode: "CHTM",
    code: "BSTM",
    name: "Bachelor of Science in Tourism Management",
  },
  {
    collegeCode: "CIT",
    code: "BSIT",
    name: "Bachelor of Science in Information Technology",
  },
  {
    collegeCode: "CIT",
    code: "BLIS",
    name: "Bachelor of Library and Information Science",
  },
  { collegeCode: "CNP", code: "BSN", name: "Bachelor of Science in Nursing" },
  { collegeCode: "CNP", code: "BSPH", name: "Bachelor of Science in Pharmacy" },
  {
    collegeCode: "SAS",
    code: "ABCOMM",
    name: "Bachelor of Arts in Communication",
  },
  {
    collegeCode: "SAS",
    code: "BSCRIM",
    name: "Bachelor of Science in Criminology",
  },
  { collegeCode: "SAS", code: "BHS", name: "Bachelor in Human Services" },
  {
    collegeCode: "SAS",
    code: "BSPSYCH",
    name: "Bachelor of Science in Psychology",
  },
  {
    collegeCode: "SBPA",
    code: "BSBA-MM",
    name: "Bachelor of Science in Business Administration, Major in Marketing Management",
  },
  {
    collegeCode: "SBPA",
    code: "BSBA-OM",
    name: "Bachelor of Science in Business Administration, Major in Operations Management",
  },
  {
    collegeCode: "SOE",
    code: "BEED",
    name: "Bachelor of Elementary Education",
  },
  {
    collegeCode: "SOE",
    code: "BSED-VE-RE",
    name: "Bachelor of Secondary Education, Major in Values Education with Religious Education",
  },
] as const;

export type VerifiedProgramCode = (typeof VERIFIED_PROGRAMS)[number]["code"];

export const programCatalogKey = (collegeCode: string, programCode: string) =>
  `${collegeCode}:${programCode}`;

export async function upsertVerifiedPrograms(
  prisma: PrismaClient,
): Promise<Map<string, Program>> {
  const collegeCodes = [
    ...new Set(VERIFIED_PROGRAMS.map((program) => program.collegeCode)),
  ];
  const colleges = await prisma.college.findMany({
    where: { code: { in: collegeCodes } },
    select: { id: true, code: true },
  });
  const collegeByCode = new Map(
    colleges.map((college) => [college.code, college.id]),
  );
  const programs = new Map<string, Program>();

  for (const offering of VERIFIED_PROGRAMS) {
    const collegeId = collegeByCode.get(offering.collegeCode);
    if (!collegeId) {
      throw new Error(
        `Missing college ${offering.collegeCode}; run the institutional seed first.`,
      );
    }

    const program = await prisma.program.upsert({
      where: { collegeId_code: { collegeId, code: offering.code } },
      update: { name: offering.name, isActive: true },
      create: {
        collegeId,
        code: offering.code,
        name: offering.name,
        description: `${offering.name} degree program`,
        isActive: true,
      },
    });
    programs.set(
      programCatalogKey(offering.collegeCode, offering.code),
      program,
    );
  }

  return programs;
}
