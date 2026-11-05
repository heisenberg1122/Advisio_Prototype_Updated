import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { prepareAuditData } from "../services/audit-contract.js";
import {
  evaluationContext,
  evaluationModelWhere,
  scopedClient,
} from "../evaluation/context.js";

// ESM safe directory name
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Ensure environment variables are loaded regardless of current working directory
if (process.env.ADVISIO_EVALUATION !== "1") dotenv.config();

const possibleEnvPaths = [
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), "../../.env"),
  path.resolve(__dirname, "../../.env"),
  path.resolve(__dirname, "../../../.env"),
  // apps/api/src/lib -> repository root
  path.resolve(__dirname, "../../../../.env"),
];

for (const envPath of possibleEnvPaths) {
  if (process.env.ADVISIO_EVALUATION !== "1" && fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }
}

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

export function createClient(databaseUrl?: string): PrismaClient {
  return new PrismaClient(
    databaseUrl ? { datasources: { db: { url: databaseUrl } } } : undefined,
  ).$extends({
    name: "audit-context",
    query: {
      $allModels: {
        $allOperations({ model, operation, args, query }) {
          const filter = evaluationModelWhere(model);
          if (
            filter &&
            [
              "findMany",
              "findFirst",
              "findFirstOrThrow",
              "findUnique",
              "findUniqueOrThrow",
              "count",
              "aggregate",
              "groupBy",
              "update",
              "updateMany",
              "delete",
              "deleteMany",
            ].includes(operation)
          ) {
            const scoped = args as { where?: Record<string, unknown> };
            scoped.where = {
              ...scoped.where,
              AND: [scoped.where?.AND || {}, filter],
            };
          }
          return query(args);
        },
      },
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
const defaultClient = global.prisma || createClient();
export const prisma = scopedClient(
  defaultClient,
  evaluationContext,
  () => process.env.ADVISIO_EVALUATION === "1",
);

if (process.env.NODE_ENV !== "production") {
  global.prisma = defaultClient;
}

export * from "@prisma/client";
