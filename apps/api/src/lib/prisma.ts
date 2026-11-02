import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { prepareAuditData } from "../services/audit-contract.js";

// ESM safe directory name
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Ensure environment variables are loaded regardless of current working directory
dotenv.config();

const possibleEnvPaths = [
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), "../../.env"),
  path.resolve(__dirname, "../../.env"),
  path.resolve(__dirname, "../../../.env"),
  // apps/api/src/lib -> repository root
  path.resolve(__dirname, "../../../../.env"),
];

for (const envPath of possibleEnvPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }
}

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

function createClient(): PrismaClient {
  return new PrismaClient().$extends({
    name: "audit-context",
    query: {
      auditLog: {
        create({ args, query }) {
          args.data = prepareAuditData(args.data);
          return query(args);
        },
        createMany({ args, query }) {
          args.data = Array.isArray(args.data)
            ? args.data.map((data) => prepareAuditData(data))
            : prepareAuditData(args.data);
          return query(args);
        },
      },
    },
  }) as unknown as PrismaClient; // Query-only extension preserves model/transaction inputs and results.
}
export const prisma = global.prisma || createClient();

if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma;
}

export * from "@prisma/client";
