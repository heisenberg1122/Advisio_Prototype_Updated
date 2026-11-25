import { once } from "node:events";
import { readFile } from "node:fs/promises";
import type { Server } from "node:http";
import express from "express";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  sign: vi.fn(),
  documentSign: vi.fn(),
  attachment: vi.fn(),
  audit: vi.fn(),
}));

vi.mock("../lib/prisma.js", async (original) => ({
  ...(await original<object>()),
  prisma: {
    user: {
      findUnique: async () => ({
        id: "google-only-user",
        firstName: "Dean",
        lastName: "Example",
        passwordHash: null,
      }),
    },
    mailAttachment: { findFirst: state.attachment },
    $transaction: async (operation: (tx: unknown) => unknown) =>
      operation({
        mailMessage: {
          create: async () => ({
            attachments: [{ id: "signed-copy", fileName: "signed.pdf" }],
          }),
        },
        mailThread: { update: vi.fn() },
        auditLog: { create: state.audit },
      }),
  },
}));
vi.mock("../services/document-signing.service.js", async (original) => ({
  ...(await original<object>()),
  documentSigningService: { sign: state.documentSign },
  createVisuallySignedPdf: async () => Buffer.from("signed PDF"),
}));

vi.mock("../middleware/auth.js", () => ({
  requireAuth: (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    if (!req.get("X-Test-User")) return void res.sendStatus(401);
    Object.assign(req, {
      user: {
        id: "google-only-user",
        roles: [req.get("X-Test-Role") || "DEAN"],
        collegeId: "college",
      },
    });
    next();
  },
}));
vi.mock("../services/official-copy.service.js", async (original) => ({
  ...(await original<object>()),
  officialCopyService: { sign: state.sign },
}));

import router from "./official-copy.routes.js";
import documentRouter from "./document.routes.js";
import mailRouter from "./mail.routes.js";
import { OfficialCopyError } from "../services/official-copy.service.js";

let server: Server;
let base: string;
beforeAll(async () => {
  const app = express();
  app.use(express.json(), router, documentRouter, mailRouter);
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Missing address");
  base = `http://127.0.0.1:${address.port}`;
});
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));
beforeEach(() => {
  state.sign.mockReset();
  state.sign.mockResolvedValue({
    duplicate: false,
    signature: { verificationCode: "signed" },
  });
  state.documentSign.mockReset();
  state.documentSign.mockResolvedValue({
    signature: { verificationCode: "signed" },
  });
  state.attachment.mockReset();
  state.attachment.mockResolvedValue({
    id: "attachment",
    mimeType: "application/pdf",
    fileName: "source.pdf",
    fileData: Buffer.from("original"),
    signedCopies: [],
    message: { threadId: "thread", thread: { participants: [] } },
  });
  state.audit.mockReset();
});

const request = (
  body: unknown,
  authenticated = true,
  path = "/official-copies/copy/sign",
  role = "DEAN",
) =>
  fetch(base + path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Test-Role": role,
      ...(authenticated ? { "X-Test-User": "google-only-user" } : {}),
    },
    body: JSON.stringify(body),
  });

it("signs with the authenticated account and explicit confirmation without a password", async () => {
  const placements = [
    { pageNumber: 1, x: 0.1, y: 0.7, width: 0.2, height: 0.1 },
  ];
  expect((await request({ confirmation: true, placements })).status).toBe(201);
  expect(state.sign).toHaveBeenCalledWith(
    expect.objectContaining({
      user: expect.objectContaining({ id: "google-only-user" }),
      placements,
    }),
  );
});

it("still requires authentication and confirmation", async () => {
  expect((await request({ confirmation: true }, false)).status).toBe(401);
  expect((await request({})).status).toBe(400);
  expect((await request({ confirmation: false })).status).toBe(400);
  expect(state.sign).not.toHaveBeenCalled();
});

it("preserves access denials from the signing service", async () => {
  state.sign.mockRejectedValue(new OfficialCopyError("Not authorized", 403));
  expect((await request({ confirmation: true })).status).toBe(403);
});

it("signs document versions without a password and preserves role and confirmation checks", async () => {
  const path = "/documents/versions/version/sign";
  expect((await request({ confirmation: true }, false, path)).status).toBe(401);
  expect(
    (await request({ confirmation: true }, true, path, "RESEARCHER")).status,
  ).toBe(403);
  expect((await request({}, true, path)).status).toBe(400);
  expect(state.documentSign).not.toHaveBeenCalled();
  expect((await request({ confirmation: true }, true, path)).status).toBe(201);
  expect(state.documentSign).toHaveBeenCalledWith(
    expect.objectContaining({ signerId: "google-only-user" }),
  );
  state.documentSign.mockRejectedValueOnce(
    new Error("Only assigned signers are authorized"),
  );
  expect((await request({ confirmation: true }, true, path)).status).toBe(403);
});

it("signs mail attachments for an account without a password and retains access and placement gates", async () => {
  const path = "/attachments/attachment/sign";
  const png = await readFile(
    new URL(
      "../../../../scripts/fixtures/pdf-evaluation-test-signature.png",
      import.meta.url,
    ),
  );
  const body = {
    confirmation: true,
    signatureImage: `data:image/png;base64,${png.toString("base64")}`,
    placements: [{ pageNumber: 1, x: 0.1, y: 0.7, width: 0.2, height: 0.1 }],
  };
  expect((await request(body, false, path)).status).toBe(401);
  expect((await request(body, true, path, "RESEARCHER")).status).toBe(403);
  expect(
    (await request({ ...body, confirmation: false }, true, path)).status,
  ).toBe(400);
  expect((await request({ ...body, placements: [] }, true, path)).status).toBe(
    400,
  );
  state.attachment.mockResolvedValueOnce(null);
  expect((await request(body, true, path)).status).toBe(404);
  expect(state.attachment.mock.calls[0][0]).toMatchObject({
    where: {
      message: {
        thread: { participants: { some: { userId: "google-only-user" } } },
      },
    },
  });
  expect((await request(body, true, path)).status).toBe(201);
  expect(state.audit).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        userId: "google-only-user",
        action: "SIGN",
        entityType: "MailAttachment",
      }),
    }),
  );
});
