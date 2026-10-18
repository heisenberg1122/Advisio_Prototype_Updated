import { PrismaClient } from "@prisma/client";
import { seedReferenceData } from "./reference-data.js";

const prisma = new PrismaClient();

async function main() {
  console.log("Initializing production-safe institutional reference data...");
  await seedReferenceData(prisma);
  console.log(
    "Reference data initialized. No users, projects, workflows, defenses, reviews, or documents were created.",
  );
}

main()
  .catch((error) => {
    console.error("Reference-data initialization failed.");
    if (process.env.NODE_ENV !== "production") console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
