import type { Prisma, AuditAction } from "@prisma/client";
import { prepareAuditData } from "./audit-contract.js";

export async function recordAudit(
  tx: Pick<Prisma.TransactionClient, "auditLog">,
  input: {
    userId?: string;
    actorRoles?: string[];
    action: AuditAction;
    entityType: string;
    entityId?: string;
    researchId?: string;
    eventType?: string;
    category?: string;
    outcome?: string;
    operationKey?: string;
    newValues?: Record<string, unknown>;
    oldValues?: Record<string, unknown>;
  },
) {
  const data = prepareAuditData(input) as Prisma.AuditLogUncheckedCreateInput;
  return tx.auditLog.create({ data });
}
