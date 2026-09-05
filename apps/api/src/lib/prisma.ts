import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

// ESM safe directory name
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Ensure environment variables are loaded regardless of current working directory
dotenv.config();

const possibleEnvPaths = [
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), "../../.env"),
  path.resolve(__dirname, "../../.env"),
  path.resolve(__dirname, "../../../.env"),
];

for (const envPath of possibleEnvPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }
}

// Fallback to local PostgreSQL if not defined
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "postgresql://postgres:admin@localhost:5432/advisio_dev?schema=public";
}

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

export const prisma = global.prisma || new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma;
}

export * from "@prisma/client";
