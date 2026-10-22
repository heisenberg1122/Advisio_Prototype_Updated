// Disposable API checks against the isolated local demo only.
// node --env-file=.env.demo.local scripts/verify-pdf-evaluation.mjs
import { PrismaClient } from "@prisma/client";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
const target = new URL(process.env.DATABASE_URL || "");
assert.equal(process.env.ADVISIO_LOCAL_DEMO, "1");
assert.equal(process.env.LOCAL_DEMO_EXECUTION, "1");
assert.equal(target.hostname, "127.0.0.1");
assert.equal(target.port, "5435");
assert.equal(target.pathname, "/advisio_demo_local");
assert.equal(target.searchParams.get("application_name"), "advisio-demo-local");
assert.equal(process.env.DIRECT_URL, process.env.DATABASE_URL);
assert.equal(process.env.STORAGE_PROVIDER, "LOCAL");
assert.notEqual(process.env.NODE_ENV, "production");
const prisma = new PrismaClient();
const api = "http://127.0.0.1:5055/api";
const fixtureId = crypto.randomUUID();
const notes = `PDF-WORKSPACE-TEST:${fixtureId}`;
let created = false;
let evaluationId;
let uploadedDocumentId;
const checks = [];
async function request(token, path, method = "GET", body, expected = 200) {
  const response = await fetch(api + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result = response.headers
    .get("content-type")
    ?.includes("application/json")
    ? await response.json()
    : Buffer.from(await response.arrayBuffer());
  assert.equal(
    response.status,
    expected,
    `${method} ${path}: ${typeof result === "object" ? JSON.stringify(result).slice(0, 300) : "unexpected response"}`,
  );
  return result;
}
try {
  const [identity] =
    await prisma.$queryRaw`SELECT current_database() AS database, current_setting('application_name') AS application`;
  assert.equal(identity.database, "advisio_demo_local");
  assert.equal(identity.application, "advisio-demo-local");
  const credentials = JSON.parse(
    await fs.readFile(
      new URL("../.demo-local/credentials.json", import.meta.url),
      "utf8",
    ),
  );
  assert.equal(credentials.datasetId, "ADVISIO-DEMO-LOCAL-V1");
  const accounts = ["professor", "panelist", "panelist-2"].map((name) =>
    credentials.accounts.find((x) => x.key === `role:${name}`),
  );
  const [professor, panelist, outsider] = await Promise.all(
    accounts.map(async (a) => ({
      account: a,
      ...(await request(null, "/auth/login", "POST", {
        email: a.email,
        password: a.password,
      })),
    })),
  );
  const professorUser = await prisma.user.findUniqueOrThrow({
    where: { email: professor.account.email },
  });
  const panelistUser = await prisma.user.findUniqueOrThrow({
    where: { email: panelist.account.email },
  });
  const template = await prisma.documentVersion.findFirstOrThrow({
    where: {
      document: {
        documentType: "EVALUATION_TEMPLATE",
        research: { groupName: "ADVISIO-DEMO-LOCAL-V1:BSIT" },
      },
    },
    include: { document: true },
    orderBy: { uploadedAt: "desc" },
  });
  const manuscript = await prisma.documentVersion.findFirstOrThrow({
    where: {
      document: {
        researchId: template.document.researchId,
        documentType: "MANUSCRIPT",
      },
    },
  });
  await prisma.defenseSession.create({
    data: {
      id: fixtureId,
      researchId: template.document.researchId,
      status: "LIVE",
      startedAt: new Date("2000-01-01"),
      notes,
      createdBy: professorUser.id,
      invitations: {
        create: {
          inviteeId: panelistUser.id,
          role: "PANELIST",
          status: "ACCEPTED",
        },
      },
      packet: {
        create: {
          manuscriptVersionId: manuscript.id,
          status: "PUBLISHED",
          publishedById: professorUser.id,
          publishedAt: new Date(),
        },
      },
    },
  });
  created = true;
  const base = `/defense-sessions/${fixtureId}/pdf-evaluation`;
  const templateBytes = await request(
    professor.token,
    `/documents/versions/${template.id}/content`,
  );
  const uploadBody = new FormData();
  uploadBody.append("kind", "EVALUATION_TEMPLATE");
  uploadBody.append(
    "file",
    new Blob([templateBytes], { type: "application/pdf" }),
    "pdf-workspace-disposable-template.pdf",
  );
  const uploadedResponse = await fetch(
    `${api}/defense-sessions/${fixtureId}/review-packet/files`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${professor.token}` },
      body: uploadBody,
    },
  );
  const uploaded = await uploadedResponse.json();
  assert.equal(uploadedResponse.status, 201, uploaded.error);
  uploadedDocumentId = uploaded.version.document.id;
  template.id = uploaded.version.id;
  checks.push("provider-neutral PDF upload");
  await request(professor.token, base + "/settings", "PUT", {
    sourceVersionId: template.id,
    signatureRequired: true,
    expectedMappingVersion: 1,
  });
  const empty = await request(panelist.token, base);
  assert.equal(empty.evaluation, null);
  checks.push("blank personal form");
  await request(outsider.token, base, "GET", undefined, 403);
  checks.push("unassigned panelist rejected");
  const original = await request(panelist.token, base + "/source");
  const originalHash = crypto
    .createHash("sha256")
    .update(original)
    .digest("hex");
  const annotations = [
    {
      id: crypto.randomUUID(),
      type: "circle",
      page: 1,
      x: 0.395,
      y: 0.328,
      width: 0.032,
      height: 0.02,
    },
    {
      id: crypto.randomUUID(),
      type: "text",
      page: 1,
      x: 0.24,
      y: 0.3,
      width: 0.3,
      height: 0.035,
      text: "TEST ONLY - Sample Student",
    },
    {
      id: crypto.randomUUID(),
      type: "comment",
      page: 2,
      x: 0.32,
      y: 0.6,
      width: 0.035,
      height: 0.025,
      text:
        "TEST ONLY: Explain the sampling design and strengthen the proposal validation. " +
        "Detailed test feedback. ".repeat(35),
    },
  ];
  let { evaluation } = await request(panelist.token, base, "PUT", {
    revision: 0,
    sourceVersionId: template.id,
    annotations,
  });
  evaluationId = evaluation.id;
  assert.equal(evaluation.revision, 1);
  checks.push("private draft saved");
  const restored = await request(panelist.token, base);
  assert.deepEqual(restored.evaluation.annotations, annotations);
  checks.push("draft restored");
  await request(
    panelist.token,
    base,
    "PUT",
    { revision: 0, sourceVersionId: template.id, annotations },
    409,
  );
  checks.push("stale revision rejected");
  const before = await request(
    professor.token,
    `/defense-sessions/${fixtureId}/pdf-evaluations`,
  );
  assert.equal(before.evaluations.length, 0);
  checks.push("professor cannot see drafts");
  await request(
    professor.token,
    base + "/settings",
    "PUT",
    {
      sourceVersionId: template.id,
      signatureRequired: false,
      expectedMappingVersion: 2,
    },
    409,
  );
  checks.push("published settings fixed after drafting");
  const unsignedPreview = await request(
    panelist.token,
    base + "/preview",
    "POST",
    { revision: 1 },
  );
  await request(
    panelist.token,
    base + "/submit",
    "POST",
    { revision: 1, previewHash: unsignedPreview.previewHash, confirmed: true },
    409,
  );
  checks.push("required signature enforced");
  const png = await fs.readFile(
    new URL("./fixtures/pdf-evaluation-test-signature.png", import.meta.url),
  );
  const signatureImage = `data:image/png;base64,${png.toString("base64")}`;
  const placement = { page: 2, x: 0.13, y: 0.8, width: 0.22, height: 0.055 };
  await request(
    panelist.token,
    base + "/sign",
    "POST",
    { revision: 1, password: "incorrect-password", placement, signatureImage },
    403,
  );
  checks.push("signature password checked");
  ({ evaluation } = await request(panelist.token, base + "/sign", "POST", {
    revision: 1,
    password: panelist.account.password,
    placement,
    signatureImage,
  }));
  assert.ok(evaluation.signedAt);
  const signedPreview = await request(
    panelist.token,
    base + "/preview",
    "POST",
    { revision: 2 },
  );
  annotations[0].x = 0.405;
  ({ evaluation } = await request(panelist.token, base, "PUT", {
    revision: 2,
    sourceVersionId: template.id,
    annotations,
  }));
  assert.equal(evaluation.signedAt, null);
  checks.push("editing invalidates signature");
  await request(
    panelist.token,
    base + "/submit",
    "POST",
    { revision: 3, previewHash: signedPreview.previewHash, confirmed: true },
    409,
  );
  ({ evaluation } = await request(panelist.token, base + "/sign", "POST", {
    revision: 3,
    password: panelist.account.password,
    placement,
    signatureImage,
  }));
  const preview = await request(panelist.token, base + "/preview", "POST", {
    revision: 4,
  });
  ({ evaluation } = await request(panelist.token, base + "/submit", "POST", {
    revision: 4,
    previewHash: preview.previewHash,
    confirmed: true,
  }));
  assert.equal(evaluation.status, "LOCKED");
  checks.push("preview and final submission locked");
  await request(
    panelist.token,
    base,
    "PUT",
    { revision: 4, sourceVersionId: template.id, annotations },
    409,
  );
  checks.push("final edits rejected");
  const content = `/defense-sessions/${fixtureId}/pdf-evaluations/${evaluation.id}/content`;
  await request(outsider.token, content, "GET", undefined, 403);
  checks.push("final PDF access scoped");
  const final = await request(professor.token, content);
  assert.equal(
    crypto.createHash("sha256").update(final).digest("hex"),
    evaluation.integrityHash,
  );
  checks.push("professor download checksum verified");
  const after = await request(
    professor.token,
    `/defense-sessions/${fixtureId}/pdf-evaluations`,
  );
  assert.equal(after.evaluations.length, 1);
  const unchanged = await request(panelist.token, base + "/source");
  assert.equal(
    crypto.createHash("sha256").update(unchanged).digest("hex"),
    originalHash,
  );
  checks.push("original PDF preserved");
  await fs.mkdir(new URL("../tmp/pdfs/",import.meta.url),{recursive:true});
  await fs.writeFile(
    new URL("../tmp/pdfs/pdf-evaluation-test-final.pdf", import.meta.url),
    final,
  );
  console.log(JSON.stringify({ passed: checks.length, checks }, null, 2));
} finally {
  if (created) {
    const item = await prisma.defenseSession.findUnique({
      where: { id: fixtureId },
      include: { packet: true },
    });
    assert.equal(
      item?.notes,
      notes,
      "Refusing to remove an unrecognized fixture",
    );
    await prisma.defenseSession.delete({ where: { id: fixtureId } });
    if (uploadedDocumentId) {
      const document = await prisma.document.findUniqueOrThrow({
        where: { id: uploadedDocumentId },
        include: { versions: true },
      });
      assert.equal(document.title, "Panel Evaluation Template");
      for (const version of document.versions) {
        assert.equal(version.fileName, "pdf-workspace-disposable-template.pdf");
        assert.equal(document.storageProvider, "LOCAL");
        const { default: path } = await import("node:path");
        const root = path.resolve("apps/api/uploads/local");
        const target = path.resolve(version.storagePath);
        assert.ok(target.startsWith(root + path.sep));
        await fs.rm(target);
      }
      await prisma.documentVersion.deleteMany({
        where: { documentId: document.id },
      });
      await prisma.document.delete({ where: { id: document.id } });
    }
    if (item.packet)
      await prisma.auditLog.deleteMany({
        where: {
          entityId: item.packet.id,
          entityType: "PdfEvaluationSettings",
        },
      });
    if (evaluationId)
      await prisma.auditLog.deleteMany({
        where: {
          entityId: evaluationId,
          entityType: {
            in: ["PdfEvaluationSignature", "PdfEvaluationSubmission"],
          },
        },
      });
  }
  await prisma.$disconnect();
}
