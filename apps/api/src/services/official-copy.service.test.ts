import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import type { AuthenticatedUser } from "../middleware/auth.js";
import {
  officialCopyAccessPolicy,
  type OfficialCopyAccessContext,
} from "./official-copy.service.js";
import { createVisuallySignedPdf } from "./document-signing.service.js";

const user = (
  roles: string[],
  collegeId: string | null = "college-a",
): AuthenticatedUser => ({
  id: "user-a",
  email: "user@example.edu",
  universityId: "UA-1",
  roles: roles as AuthenticatedUser["roles"],
  permissions: [],
  collegeId,
  programId: null,
});

const context = (
  overrides: Partial<OfficialCopyAccessContext> = {},
): OfficialCopyAccessContext => ({
  collegeId: "college-a",
  isProjectCreator: false,
  activeProjectRoles: [],
  isWorkflowOwner: false,
  hasAcceptedDefenseAssignment: false,
  hasLockedPanelEvaluation: false,
  ...overrides,
});

describe("officialCopyAccessPolicy", () => {
  it("allows project students to view but never finalize or sign their own archive", () => {
    const access = officialCopyAccessPolicy(
      user(["RESEARCHER"]),
      context({ activeProjectRoles: ["LEADER"] }),
    );
    expect(access.canView).toBe(true);
    expect(access.canFinalize).toBe(false);
    expect(access.canSign).toBe(false);
    expect(access.canRevoke).toBe(false);
  });

  it("does not let a second faculty role bypass the student-owner restriction", () => {
    const access = officialCopyAccessPolicy(
      user(["RESEARCHER", "ADVISER"]),
      context({ activeProjectRoles: ["LEADER", "ADVISER"] }),
    );
    expect(access.canFinalize).toBe(false);
    expect(access.canSign).toBe(false);
  });

  it("allows only the assigned adviser to finalize and sign", () => {
    expect(
      officialCopyAccessPolicy(user(["ADVISER"]), context()).canView,
    ).toBe(false);
    const assigned = officialCopyAccessPolicy(
      user(["ADVISER"]),
      context({ activeProjectRoles: ["ADVISER"] }),
    );
    expect(assigned.canFinalize).toBe(true);
    expect(assigned.canSign).toBe(true);
    expect(assigned.canRevoke).toBe(false);
  });

  it("requires the coordinator to own the project's assigned workflow", () => {
    expect(
      officialCopyAccessPolicy(
        user(["RESEARCH_COORDINATOR"]),
        context(),
      ).canFinalize,
    ).toBe(false);
    expect(
      officialCopyAccessPolicy(
        user(["RESEARCH_COORDINATOR"]),
        context({ isWorkflowOwner: true }),
      ).canFinalize,
    ).toBe(true);
  });

  it("allows an assigned panelist to view but requires a locked evaluation to sign", () => {
    const assigned = context({ hasAcceptedDefenseAssignment: true });
    expect(
      officialCopyAccessPolicy(user(["PANELIST"]), assigned).canView,
    ).toBe(true);
    expect(
      officialCopyAccessPolicy(user(["PANELIST"]), assigned).canSign,
    ).toBe(false);
    expect(
      officialCopyAccessPolicy(
        user(["PANELIST"]),
        context({
          hasAcceptedDefenseAssignment: true,
          hasLockedPanelEvaluation: true,
        }),
      ).canSign,
    ).toBe(true);
  });

  it("applies college scope to the Dean/DEAN role", () => {
    const scoped = officialCopyAccessPolicy(user(["DEAN"]), context());
    expect(scoped.canView).toBe(true);
    expect(scoped.canFinalize).toBe(true);
    expect(scoped.canRevoke).toBe(true);
    expect(
      officialCopyAccessPolicy(
        user(["DEAN"], "college-b"),
        context(),
      ).canView,
    ).toBe(false);
  });

  it("rejects retired VPAA archival authority", () => {
    const access = officialCopyAccessPolicy(user(["VPAA"], null), context());
    expect(access.canView).toBe(false);
    expect(access.canFinalize).toBe(false);
    expect(access.canSign).toBe(false);
    expect(access.canRevoke).toBe(false);
  });

  it("does not grant private academic-record access to a system administrator", () => {
    const access = officialCopyAccessPolicy(
      user(["SYSTEM_ADMIN"], null),
      context(),
    );
    expect(access.canView).toBe(false);
    expect(access.canFinalize).toBe(false);
    expect(access.canSign).toBe(false);
    expect(access.canRevoke).toBe(false);
  });
});

describe("official-copy visual signature artifact", () => {
  it("creates a separate readable PDF without mutating the source bytes", async () => {
    const sourcePdf = await PDFDocument.create();
    sourcePdf.addPage([300, 400]);
    const original = Buffer.from(await sourcePdf.save());
    const originalSnapshot = Buffer.from(original);
    const transparentPng = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      "base64",
    );

    const signed = await createVisuallySignedPdf({
      original,
      signatureImage: transparentPng,
      signerName: "Authorized Faculty",
      placements: [
        {
          pageNumber: 1,
          x: 0.55,
          y: 0.7,
          width: 0.25,
          height: 0.08,
          includeName: true,
          includeDate: true,
        },
      ],
      signedAt: new Date("2026-10-14T08:00:00.000Z"),
    });

    expect(original.equals(originalSnapshot)).toBe(true);
    expect(signed.equals(original)).toBe(false);
    await expect(PDFDocument.load(signed)).resolves.toBeDefined();
  });

  it("rejects a signature placement outside the selected page", async () => {
    const sourcePdf = await PDFDocument.create();
    sourcePdf.addPage([300, 400]);
    await expect(
      createVisuallySignedPdf({
        original: Buffer.from(await sourcePdf.save()),
        signatureImage: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
          "base64",
        ),
        signerName: "Authorized Faculty",
        placements: [
          { pageNumber: 1, x: 0.9, y: 0.9, width: 0.2, height: 0.2 },
        ],
        signedAt: new Date(),
      }),
    ).rejects.toThrow("fit completely");
  });
});
