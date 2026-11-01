import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";

export const auditContext = new AsyncLocalStorage<{
  requestId: string;
  actor: () => { id: string; roles: string[] } | undefined;
  ip?: string;
  userAgent?: string;
}>();

export const auditCategories = [
  "ACCOUNT",
  "ACADEMIC",
  "DOCUMENT",
  "CONFIGURATION",
  "SECURITY",
  "LEGACY",
] as const;
export function auditCategory(entity: string) {
  if (
    /Security|Authentication|Password.?Reset|Session|AuditExport/i.test(entity)
  )
    return "SECURITY";
  if (/USER|ADVISER|FACULTY|REGISTRATION|ONBOARDING/.test(entity))
    return "ACCOUNT";
  if (/College|Program|AcademicYear|INTEGRATION|ANNOUNCEMENT/.test(entity))
    return "CONFIGURATION";
  if (
    /Document|Signature|OfficialCopy|Review|Manuscript|Certificate/.test(entity)
  )
    return "DOCUMENT";
  return "ACADEMIC";
}

// A final safety net for legacy writers. New writers also use explicit field allowlists.
const secret =
  /password|token|cookie|authorization|secret|credential|connectionstring|privatekey|image(data|url)|dataurl|base64|storagepath|overallcomment|revisioninstructions|withdrawalnote|researcheremail|studentnumber/i;
export function safeAuditValue(
  value: unknown,
  depth = 0,
): Prisma.InputJsonValue | null {
  if (value == null) return null;
  if (depth > 5) return "[depth limit]";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string")
    return value
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
      .slice(0, 2000);
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean") return value;
  if (Array.isArray(value))
    return value.slice(0, 50).map((entry) => safeAuditValue(entry, depth + 1));
  if (typeof value !== "object") return null;
  return Object.fromEntries(
    Object.entries(value)
      .slice(0, 80)
      .filter(([key]) => !secret.test(key))
      .map(([key, entry]) => [
        key.slice(0, 100),
        safeAuditValue(entry, depth + 1),
      ]),
  );
}
export function prepareAuditData<T extends Record<string, unknown>>(
  input: T,
): T {
  const context = auditContext.getStore();
  const actor = context?.actor();
  const result: Record<string, unknown> = { ...input };
  result.contractVersion ??= 1;
  result.eventType ??= `${input.entityType}.${input.action}`.slice(0, 100);
  result.category ??= auditCategory(String(input.entityType));
  result.outcome ??=
    (input.newValues as Record<string, unknown> | undefined)?.matches === false
      ? "FAILURE"
      : "SUCCESS";
  const project =
    input.entityType === "ResearchProject"
      ? input.entityId
      : (input.newValues as Record<string, unknown> | undefined)?.researchId;
  if (typeof project === "string" && /^[0-9a-f-]{36}$/i.test(project))
    result.researchId ??= project;
  result.actorReference ??= input.userId || null;
  result.actorRoles ??= actor && actor.id === input.userId ? actor.roles : [];
  result.requestId ??= context?.requestId || randomUUID();
  result.ipAddress ??= context?.ip;
  result.userAgent =
    String(input.userAgent || context?.userAgent || "").slice(0, 500) || null;
  for (const key of ["oldValues", "newValues"]) {
    if (input[key] !== undefined) {
      // Preserve Prisma's explicit JSON/DB null sentinels in existing transaction writers.
      if (
        input[key] &&
        /^(JsonNull|DbNull)$/.test((input[key] as object).constructor?.name)
      )
        continue;
      const value = safeAuditValue(input[key]);
      if (Buffer.byteLength(JSON.stringify(value), "utf8") > 16_384)
        throw new Error("Audit payload exceeds 16 KiB");
      result[key] = value;
    }
  }
  return result as T;
}
