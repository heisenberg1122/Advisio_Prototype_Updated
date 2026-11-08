import { once } from "node:events";
import type { Server } from "node:http";
import express from "express";
import { PDFDocument } from "pdf-lib";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  expect,
  it,
  vi,
} from "vitest";

const state = vi.hoisted(() => ({
  sessionId: "00000000-0000-4000-8000-000000000001",
  versionId: "00000000-0000-4000-8000-000000000002",
  evaluationId: "00000000-0000-4000-8000-000000000003",
  upload: vi.fn(),
  read: vi.fn(),
  audit: vi.fn(),
  evaluations: new Map<string, Record<string, unknown>>(),
  template: Buffer.alloc(0),
}));

vi.mock("../middleware/auth.js", () => ({
  requireAuth: (
    req: express.Request,
    _res: express.Response,
    next: express.NextFunction,
  ) => {
    const id = req.get("X-Test-Panelist") ?? "panelist-1";
    Object.assign(req, {
      user: { id, roles: ["PANELIST"], collegeId: "college" },
    });
    next();
  },
}));
vi.mock("../services/defense-manuscript.service.js", () => ({
  hasDefenseFacilitatorAccess: () => false,
}));
vi.mock("../services/document.service.js", () => ({
  documentService: {
    readStoredVersionFile: async () => ({ buffer: state.template }),
  },
}));
vi.mock(
  "../services/pdf-evaluation-storage.service.js",
  async (importOriginal) => ({
    ...(await importOriginal<object>()),
    readPdfEvaluationArtifact: state.read,
    storePdfEvaluationArtifact: state.upload,
  }),
);
vi.mock("../lib/prisma.js", () => {
  const session = {
    id: state.sessionId,
    status: "LIVE",
    research: { collegeId: "college" },
    packet: {
      status: "PUBLISHED",
      evaluationMode: "PDF",
      evaluationSignatureRequired: false,
      evaluationTemplateVersionId: state.versionId,
    },
    invitations: ["panelist-1", "panelist-2"].map((inviteeId) => ({
      inviteeId,
      status: "ACCEPTED",
      role: "PANELIST",
    })),
  };
  const db = {
    defenseSession: {
      findUnique: async () => session,
      findUniqueOrThrow: async () => session,
    },
    documentVersion: { findUniqueOrThrow: async () => ({ document: {} }) },
    pdfEvaluation: {
      findUnique: async ({
        where,
      }: {
        where: {
          id?: string;
          defenseSessionId_panelistId?: { panelistId: string };
        };
      }) =>
        where.id
          ? ([...state.evaluations.values()].find(
              (item) => item.id === where.id,
            ) ?? null)
          : (state.evaluations.get(
              where.defenseSessionId_panelistId!.panelistId,
            ) ?? null),
      create: async ({
        data,
      }: {
        data: Record<string, unknown> & { panelistId: string };
      }) => {
        const item = { id: state.evaluationId, status: "DRAFT", ...data };
        state.evaluations.set(data.panelistId, item);
        return item;
      },
      update: async ({ data }: { data: Record<string, unknown> }) => {
        const item = state.evaluations.get("panelist-1")!;
        Object.assign(item, data);
        return item;
      },
    },
    auditLog: { create: state.audit },
    $queryRaw: vi.fn(),
  };
  return {
    prisma: {
      ...db,
      $transaction: async (operation: (tx: typeof db) => unknown) =>
        operation(db),
    },
  };
});

import router from "./pdf-evaluation.routes.js";
import { PdfEvaluationStorageError } from "../services/pdf-evaluation-storage.service.js";

let server: Server;
let base: string;

beforeAll(async () => {
  const template = await PDFDocument.create();
  template.addPage();
  state.template = Buffer.from(await template.save());
  const app = express();
  app.use(express.json(), router);
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (typeof address !== "object" || !address)
    throw new Error("Test server address missing");
  base = `http://127.0.0.1:${address.port}/defense-sessions/${state.sessionId}`;
});
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));
afterEach(() => vi.unstubAllEnvs());
beforeEach(() => {
  vi.stubEnv("PDF_EVALUATION_DRIVE_FOLDER_ID", "restricted");
  vi.stubEnv("PDF_EVALUATION_DRIVE_SESSION_IDS", state.sessionId);
  vi.stubEnv("PDF_EVALUATION_DRIVE_ALL_SESSIONS", "false");
  vi.stubEnv("ADVISIO_LOCAL_DEMO", "0");
  vi.stubEnv("ADVISIO_EVALUATION", "0");
  vi.resetAllMocks();
  state.evaluations.clear();
  state.upload.mockResolvedValue("source-file");
  state.read.mockResolvedValue(state.template);
});

function request(
  method: string,
  path: string,
  data?: unknown,
  panelist = "panelist-1",
) {
  return fetch(`${base}/${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Test-Panelist": panelist,
    },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
}

const draft = () => ({
  revision: 0,
  sourceVersionId: state.versionId,
  annotations: [
    {
      id: state.evaluationId,
      type: "check",
      page: 1,
      x: 0.1,
      y: 0.1,
      width: 0.1,
      height: 0.1,
    },
  ],
});

it("keeps a draft retryable, saves only file references, and gates the final download", async () => {
  expect((await request("PUT", "pdf-evaluation", draft())).status).toBe(200);
  const item = state.evaluations.get("panelist-1");
  expect(item).toMatchObject({
    sourceData: null,
    sourceDriveFileId: "source-file",
  });
  const preview = await request("POST", "pdf-evaluation/preview", {
    revision: 1,
  });
  expect(preview.status).toBe(200);
  const { previewHash, pdfBase64 } = await preview.json();
  const submit = { revision: 1, previewHash, confirmed: true };

  state.upload.mockRejectedValueOnce(new PdfEvaluationStorageError());
  expect((await request("POST", "pdf-evaluation/submit", submit)).status).toBe(
    503,
  );
  expect(item?.status).toBe("DRAFT");
  expect(state.audit).not.toHaveBeenCalled();

  state.upload.mockResolvedValueOnce("final-file");
  expect((await request("POST", "pdf-evaluation/submit", submit)).status).toBe(
    200,
  );
  expect(item).toMatchObject({
    status: "LOCKED",
    finalData: null,
    finalDriveFileId: "final-file",
  });
  expect(state.upload.mock.lastCall?.[2]).toEqual(
    Buffer.from(pdfBase64, "base64"),
  );
  expect((await request("POST", "pdf-evaluation/submit", submit)).status).toBe(
    200,
  );
  expect(state.upload).toHaveBeenCalledTimes(3);
  expect(state.audit).toHaveBeenCalledOnce();

  const finalPath = `pdf-evaluations/${state.evaluationId}/content`;
  const readCalls = state.read.mock.calls.length;
  expect(
    (await request("GET", finalPath, undefined, "panelist-2")).status,
  ).toBe(403);
  expect(state.read).toHaveBeenCalledTimes(readCalls);
  const final = Buffer.from(pdfBase64, "base64");
  state.read.mockResolvedValueOnce(final);
  const response = await request("GET", finalPath);
  expect(Buffer.from(await response.arrayBuffer())).toEqual(final);
});

it("uses PostgreSQL for a defense outside the Drive rollout allowlist", async () => {
  vi.stubEnv("PDF_EVALUATION_DRIVE_SESSION_IDS", state.versionId);
  expect((await request("PUT", "pdf-evaluation", draft())).status).toBe(200);
  const item = state.evaluations.get("panelist-1");
  expect(item?.sourceDriveFileId).toBeNull();
  expect(Buffer.from(item?.sourceData as Uint8Array)).toEqual(state.template);
  expect(state.upload).not.toHaveBeenCalled();
});

it("returns a retryable response when direct PDF processing is at capacity", async () => {
  expect((await request("PUT", "pdf-evaluation", draft())).status).toBe(200);
  let release!: () => void;
  const pending = new Promise<Buffer>((resolve) => {
    release = () => resolve(state.template);
  });
  state.read.mockReturnValue(pending);
  const active = Array.from({ length: 4 }, () => request("GET", "pdf-evaluation/source"));
  try {
    await vi.waitFor(() => expect(state.read).toHaveBeenCalledTimes(4));
    const busy = await request("GET", "pdf-evaluation/source");
    expect(busy.status).toBe(503);
    expect(busy.headers.get("retry-after")).toBe("2");
  } finally {
    release();
    await Promise.all(active);
  }
});
