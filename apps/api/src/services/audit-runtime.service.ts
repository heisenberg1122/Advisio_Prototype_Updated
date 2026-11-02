import { prisma } from "../lib/prisma.js";

export async function verifyAuditRuntimeRole() {
  const [role] = await prisma.$queryRaw<{ protected: boolean }[]>`
    SELECT NOT pg_has_role(current_user, pg_get_userbyid(c.relowner), 'USAGE')
      AND NOT has_table_privilege(current_user, c.oid, 'UPDATE')
      AND NOT has_table_privilege(current_user, c.oid, 'DELETE')
      AND NOT has_table_privilege(current_user, c.oid, 'TRUNCATE')
      AND has_table_privilege(current_user, c.oid, 'INSERT')
      AND has_table_privilege(current_user, c.oid, 'SELECT') AS protected
    FROM pg_class c WHERE c.oid = 'audit_logs'::regclass`;
  if (!role?.protected) {
    if (process.env.AUDIT_ENFORCE_RUNTIME_ROLE === "1")
      throw new Error(
        "Audit runtime must use a non-owner role with SELECT/INSERT only on audit_logs",
      );
    console.warn(
      "Audit database role is not restricted. Configure a separate runtime role and enable AUDIT_ENFORCE_RUNTIME_ROLE=1 before claiming append-only protection.",
    );
  }
}
