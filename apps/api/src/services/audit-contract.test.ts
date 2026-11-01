import { describe, it, expect } from "vitest";
import {
  auditContext,
  prepareAuditData,
  safeAuditValue,
} from "./audit-contract.js";

describe("audit event privacy and attribution", () => {
  it("removes nested secrets and bounds strings, arrays and payload size", () => {
    expect(
      safeAuditValue({
        status: "ACTIVE",
        passwordHash: "secret",
        nested: {
          accessToken: "secret",
          cookie: "secret",
          note: "a".repeat(3000),
        },
      }),
    ).toEqual({ status: "ACTIVE", nested: { note: "a".repeat(2000) } });
    expect((safeAuditValue(Array(100).fill("value")) as unknown[]).length).toBe(
      50,
    );
    expect(() =>
      prepareAuditData({
        entityType: "USER",
        action: "UPDATE",
        newValues: Object.fromEntries(
          Array.from({ length: 20 }, (_, i) => [`field${i}`, "a".repeat(2000)]),
        ),
      }),
    ).toThrow("16 KiB");
  });
  it("captures validated role context only for the matching actor", () => {
    auditContext.run(
      {
        requestId: "request",
        actor: () => ({ id: "actor", roles: ["ADVISER"] }),
      },
      () => {
        expect(
          prepareAuditData({
            userId: "actor",
            entityType: "Review",
            action: "CREATE",
          }),
        ).toMatchObject({
          actorReference: "actor",
          actorRoles: ["ADVISER"],
          requestId: "request",
          category: "DOCUMENT",
          contractVersion: 1,
        });
        expect(
          prepareAuditData({
            userId: "other",
            entityType: "Review",
            action: "CREATE",
          }),
        ).toMatchObject({ actorRoles: [] });
      },
    );
  });
  it("keeps failed authentication actors anonymous and derives explicit project scope", () => {
    expect(
      prepareAuditData({
        entityType: "SecuritySummary",
        action: "UPDATE",
        outcome: "FAILURE",
      }),
    ).toMatchObject({
      actorReference: null,
      actorRoles: [],
      category: "SECURITY",
      outcome: "FAILURE",
    });
    expect(
      prepareAuditData({
        entityType: "ResearchProject",
        entityId: "11111111-1111-4111-8111-111111111111",
        action: "UPDATE",
      }),
    ).toMatchObject({ researchId: "11111111-1111-4111-8111-111111111111" });
  });
});
