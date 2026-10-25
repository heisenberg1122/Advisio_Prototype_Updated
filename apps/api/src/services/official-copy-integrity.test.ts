import crypto from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthenticatedUser } from "../middleware/auth.js";

const mocks = vi.hoisted(() => ({
  findCopy: vi.fn(), findResearch: vi.fn(), audit: vi.fn(), loadFile: vi.fn(),
}));
vi.mock("../lib/prisma.js", () => ({ prisma: {
  officialCopy: { findUnique: mocks.findCopy },
  researchProject: { findUnique: mocks.findResearch },
  auditLog: { create: mocks.audit },
} }));
vi.mock("./document-signing.service.js", async (importOriginal) => ({
  ...await importOriginal<typeof import("./document-signing.service.js")>(),
  loadVersionFile: mocks.loadFile,
}));

import { officialCopyService } from "./official-copy.service.js";

const user: AuthenticatedUser = {
  id: "student", email: "student@example.edu", universityId: "ST-1",
  roles: ["RESEARCHER"], permissions: [], collegeId: "college", programId: null,
};
const original = Buffer.from("%PDF-1.7\noriginal fixture bytes");
const checksum = crypto.createHash("sha256").update(original).digest("hex");

describe("official-copy integrity evidence", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.findCopy.mockResolvedValue({
      id: "copy", researchId: "project", checksum, signatures: [],
    });
    mocks.findResearch.mockResolvedValue({
      collegeId: "college", createdBy: "student",
      members: [{ projectRole: "LEADER" }], workflowInstance: null,
      defenseSessions: [], evaluations: [],
    });
    mocks.loadFile.mockResolvedValue(Buffer.from(original));
    mocks.audit.mockResolvedValue({ id: "audit" });
  });

  it("returns reproducible hashes and records the same evidence in the audit log", async () => {
    const result = await officialCopyService.verify(user, "copy");
    expect(result).toMatchObject({
      matches: true, algorithm: "SHA-256", checksum,
      expectedChecksum: checksum, actualChecksum: checksum,
      officialCopyId: "copy", signatureId: null,
    });
    expect(mocks.audit).toHaveBeenCalledWith({ data: expect.objectContaining({
      userId: user.id, entityType: "OfficialCopyIntegrity", entityId: "copy",
      newValues: {
        matches: true, algorithm: "SHA-256", expectedChecksum: checksum,
        actualChecksum: checksum, officialCopyId: "copy", signatureId: null,
        checkedAt: result.checkedAt.toISOString(),
      },
    }) });
  });

  it("detects a one-byte file change without changing the reference", async () => {
    const changed = Buffer.from(original);
    changed[changed.length - 1] ^= 1;
    mocks.loadFile.mockResolvedValue(changed);
    const result = await officialCopyService.verify(user, "copy");
    expect(result.matches).toBe(false);
    expect(result.expectedChecksum).toBe(checksum);
    expect(result.actualChecksum).not.toBe(checksum);
    expect(mocks.audit.mock.calls[0][0].data.newValues.matches).toBe(false);
  });

  it("checks a signed artifact against its own hash rather than the original", async () => {
    const signed = Buffer.from("signed PDF fixture");
    const signedFileHash = crypto.createHash("sha256").update(signed).digest("hex");
    const signature = { id: "signature", signedFileHash };
    mocks.findCopy.mockResolvedValue({
      id: "copy", researchId: "project", checksum, signatures: [signature],
    });
    mocks.loadFile.mockResolvedValue(signed);
    const result = await officialCopyService.verify(user, "copy", "signature");
    expect(result).toMatchObject({ matches: true, expectedChecksum: signedFileHash, signatureId: "signature" });
    expect(mocks.loadFile).toHaveBeenCalledWith(signature);
    expect(mocks.audit.mock.calls[0][0].data.entityType).toBe("OfficialCopySignatureIntegrity");
  });

  it("denies a foreign-project user before reading file bytes", async () => {
    mocks.findResearch.mockResolvedValue({
      collegeId: "college", createdBy: "another-student", members: [],
      workflowInstance: null, defenseSessions: [], evaluations: [],
    });
    await expect(officialCopyService.verify(user, "copy")).rejects.toMatchObject({ statusCode: 403 });
    expect(mocks.loadFile).not.toHaveBeenCalled();
    expect(mocks.audit).not.toHaveBeenCalled();
  });

  it("rejects a signature belonging to another copy", async () => {
    await expect(officialCopyService.verify(user, "copy", "foreign-signature"))
      .rejects.toMatchObject({ statusCode: 404 });
    expect(mocks.loadFile).not.toHaveBeenCalled();
  });

  it("does not report a successful verification when storage cannot be read", async () => {
    mocks.loadFile.mockRejectedValue(new Error("Storage unavailable"));
    await expect(officialCopyService.verify(user, "copy")).rejects.toThrow("Storage unavailable");
    expect(mocks.audit).not.toHaveBeenCalled();
  });
});
