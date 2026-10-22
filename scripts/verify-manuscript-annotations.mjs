// Disposable checks; requires the isolated local demo API and seeded accounts.
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
const prisma = new PrismaClient(),
  api = "http://127.0.0.1:5055/api";
const sessionId = crypto.randomUUID(),
  marker = `MANUSCRIPT-REVIEW-TEST:${sessionId}`,
  checks = [];
let created = false;
let replacementDocumentId;
const hash = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
async function request(token, path, method = "GET", body, status = 200) {
  const r = await fetch(api + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result = r.headers.get("content-type")?.includes("application/json")
    ? await r.json()
    : Buffer.from(await r.arrayBuffer());
  assert.equal(
    r.status,
    status,
    `${method} ${path}: ${Buffer.isBuffer(result) ? "Unexpected PDF response" : JSON.stringify(result)}`,
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
  const project = await prisma.researchProject.findFirstOrThrow({
    where: { groupName: "ADVISIO-DEMO-LOCAL-V1:BSIT" },
    include: {
      members: {
        where: { leftAt: null, projectRole: { in: ["LEADER", "MEMBER"] } },
        include: { user: true },
      },
    },
  });
  const researcher = credentials.accounts.find((a) =>
    project.members.some((m) => m.user.email === a.email),
  );
  assert.ok(researcher);
  const definitions = ["professor", "panelist", "panelist-2", "panelist-3"].map(
    (name) => credentials.accounts.find((a) => a.key === `role:${name}`),
  );
  definitions.push(researcher);
  const [professor, owner, peer, outsider, student] = await Promise.all(
    definitions.map(async (account) => ({
      account,
      ...(await request(null, "/auth/login", "POST", {
        email: account.email,
        password: account.password,
      })),
    })),
  );
  const users = await Promise.all(
    [professor, owner, peer].map((a) =>
      prisma.user.findUniqueOrThrow({ where: { email: a.account.email } }),
    ),
  );
  const originalVersion = await prisma.documentVersion.findFirstOrThrow({
    where: { document: { researchId: project.id, documentType: "MANUSCRIPT" } },
    include: { document: true },
  });
  const replacement = await prisma.document.create({
    data: {
      researchId: project.id,
      documentType: "MANUSCRIPT",
      title: "Disposable replacement manuscript",
      creationKey: marker,
      createdBy: users[0].id,
      storageProvider: originalVersion.document.storageProvider,
      versions: {
        create: {
          versionNumber: 1,
          fileName: "replacement-manuscript-test.pdf",
          mimeType: "application/pdf",
          fileSize: originalVersion.fileSize,
          storagePath: originalVersion.storagePath,
          googleDriveFileId: originalVersion.googleDriveFileId,
          uploadedBy: users[0].id,
        },
      },
    },
    include: { versions: true },
  });
  replacementDocumentId = replacement.id;
  const versionId = originalVersion.id,
    nextVersionId = replacement.versions[0].id;
  await prisma.defenseSession.create({
    data: {
      id: sessionId,
      researchId: project.id,
      notes: marker,
      status: "SCHEDULED",
      createdBy: users[0].id,
      invitations: {
        create: users
          .slice(1)
          .map((u) => ({
            inviteeId: u.id,
            status: "ACCEPTED",
            role: "PANELIST",
          })),
      },
      packet: {
        create: {
          manuscriptVersionId: versionId,
          publishedById: users[0].id,
          status: "PUBLISHED",
          publishedAt: new Date(),
        },
      },
    },
  });
  created = true;
  const base = `/defense-sessions/${sessionId}/manuscript-annotations/${versionId}`,
    shared = `/defense-sessions/${sessionId}/manuscript-feedback`;
  assert.equal((await request(owner.token, base)).review, null);
  checks.push("blank private manuscript review");
  const original = await request(owner.token, base + "/source"),
    originalHash = hash(original);
  await request(professor.token, base, "GET", undefined, 403);
  await request(student.token, base, "GET", undefined, 403);
  checks.push("professor and students cannot read drafts");
  await request(outsider.token, base + "/source", "GET", undefined, 403);
  checks.push("unassigned panelist denied");
  await request(
    owner.token,
    `/defense-sessions/${sessionId}/manuscript-annotations/${nextVersionId}`,
    "GET",
    undefined,
    404,
  );
  checks.push("arbitrary document versions denied");
  let annotations = [
    {
      id: crypto.randomUUID(),
      type: "highlight",
      page: 1,
      x: 0.1,
      y: 0.15,
      width: 0.3,
      height: 0.03,
    },
    {
      id: crypto.randomUUID(),
      type: "comment",
      page: 1,
      x: 0.4,
      y: 0.25,
      width: 0.035,
      height: 0.025,
      text: "TEST ONLY: Explain how the findings support the research objectives.",
    },
  ];
  let { review } = await request(owner.token, base, "PUT", {
    revision: 0,
    sourceVersionId: versionId,
    annotations,
  });
  assert.equal(review.revision, 1);
  assert.deepEqual(
    (await request(owner.token, base)).review.annotations,
    annotations,
  );
  checks.push("annotations saved and restored");
  assert.equal((await request(peer.token, base)).review, null);
  checks.push("peer drafts isolated");
  await request(
    owner.token,
    base,
    "PUT",
    { revision: 0, sourceVersionId: versionId, annotations },
    409,
  );
  checks.push("stale revisions rejected");
  assert.equal((await request(student.token, shared)).publications.length, 0);
  assert.equal((await request(professor.token, shared)).publications.length, 0);
  checks.push("private drafts absent from shared views");
  let preview = await request(owner.token, base + "/preview", "POST", {
    revision: 1,
  });
  annotations = annotations.map((m) =>
    m.type === "comment"
      ? {
          ...m,
          text: "TEST ONLY: Clarify the method and report the limitations.",
        }
      : m,
  );
  ({ review } = await request(owner.token, base, "PUT", {
    revision: 1,
    sourceVersionId: versionId,
    annotations,
  }));
  await request(
    owner.token,
    base + "/share",
    "POST",
    { revision: 2, previewHash: preview.previewHash, confirmed: true },
    409,
  );
  checks.push("editing invalidates sharing preview");
  preview = await request(owner.token, base + "/preview", "POST", {
    revision: 2,
  });
  await request(
    owner.token,
    base + "/share",
    "POST",
    { revision: 2, previewHash: preview.previewHash, confirmed: false },
    400,
  );
  checks.push("explicit recipient confirmation required");
  const first = await request(owner.token, base + "/share", "POST", {
    revision: 2,
    previewHash: preview.previewHash,
    confirmed: true,
  });
  const content = shared + `/${first.publication.id}/content`;
  const published = await request(student.token, content);
  assert.equal(hash(await request(professor.token, content)), hash(published));
  checks.push("professor and active group can download shared feedback");
  assert.equal((await request(peer.token, shared)).publications.length, 0);
  await request(peer.token, content, "GET", undefined, 404);
  checks.push("other panelists cannot read shared peer copies");
  await request(outsider.token, content, "GET", undefined, 403);
  checks.push("unrelated users denied shared PDF access");
  const publicList = await request(student.token, shared);
  assert.equal(publicList.publications.length, 1);
  assert.equal(publicList.publications[0].integrityHash, hash(published));
  checks.push("shared PDF checksum and version recorded");
  assert.equal((await request(owner.token, base)).editable, true);
  checks.push("sharing keeps further drafts editable");
  annotations = annotations.map((m) =>
    m.type === "comment"
      ? { ...m, text: "TEST ONLY: New private feedback, not shared yet." }
      : m,
  );
  ({ review } = await request(owner.token, base, "PUT", {
    revision: 2,
    sourceVersionId: versionId,
    annotations,
  }));
  assert.equal(hash(await request(student.token, content)), hash(published));
  assert.equal((await request(student.token, shared)).publications.length, 1);
  checks.push("later private edits leave shared snapshot unchanged");
  preview = await request(owner.token, base + "/preview", "POST", {
    revision: 3,
  });
  const second = await request(owner.token, base + "/share", "POST", {
    revision: 3,
    previewHash: preview.previewHash,
    confirmed: true,
  });
  assert.notEqual(second.publication.id, first.publication.id);
  const repeated = await request(owner.token, base + "/share", "POST", {
    revision: 3,
    previewHash: preview.previewHash,
    confirmed: true,
  });
  assert.equal(repeated.publication.id, second.publication.id);
  checks.push("resharing creates a new snapshot only for a new revision");
  await assert.rejects(
    prisma.packetReviewPublication.update({
      where: { id: first.publication.id },
      data: { integrityHash: "0".repeat(64) },
    }),
  );
  checks.push("database protects shared snapshots from updates");
  await prisma.defensePacket.update({
    where: { defenseSessionId: sessionId },
    data: {
      manuscriptVersionId: nextVersionId,
      mappingVersion: { increment: 1 },
    },
  });
  assert.equal((await request(owner.token, base)).editable, false);
  await request(
    owner.token,
    base,
    "PUT",
    { revision: 3, sourceVersionId: versionId, annotations },
    409,
  );
  checks.push("replaced manuscript reviews become read-only");
  const history = await request(
    owner.token,
    `/defense-sessions/${sessionId}/manuscript-annotations`,
  );
  assert.equal(history.currentVersion.id, nextVersionId);
  assert.ok(history.reviewedVersions.some((v) => v.id === versionId));
  checks.push("version history retained");
  assert.equal(
    (
      await request(
        owner.token,
        `/defense-sessions/${sessionId}/manuscript-annotations/${nextVersionId}`,
      )
    ).review,
    null,
  );
  checks.push("replacement manuscript starts a separate blank draft");
  assert.equal((await request(student.token, shared)).publications.length, 2);
  assert.equal(
    (await request(student.token, shared)).publications[0].currentVersion,
    false,
  );
  checks.push("recipients retain earlier-version feedback history");
  const oldPreview = await request(owner.token, base + "/preview", "POST", {
    revision: 3,
  });
  assert.ok(oldPreview.pdfBase64);
  checks.push("earlier drafts remain previewable and downloadable");
  assert.equal(
    hash(await request(owner.token, base + "/source")),
    originalHash,
  );
  checks.push("original PDF bytes preserved");
  await prisma.defenseInvitation.updateMany({
    where: { defenseSessionId: sessionId, inviteeId: users[1].id },
    data: { status: "REMOVED" },
  });
  await request(owner.token, base, "GET", undefined, 403);
  checks.push("revoked assignments lose access");
  await fs.mkdir(new URL("../tmp/pdfs/", import.meta.url), { recursive: true });
  await fs.writeFile(
    new URL("../tmp/pdfs/shared-manuscript-test.pdf", import.meta.url),
    published,
  );
  console.log(JSON.stringify({ passed: checks.length, checks }, null, 2));
} finally {
  if (created) {
    const session = await prisma.defenseSession.findUniqueOrThrow({
      where: { id: sessionId },
    });
    assert.equal(session.notes, marker);
    const publications = await prisma.packetReviewPublication.findMany({
      where: { review: { defenseSessionId: sessionId } },
      select: { id: true },
    });
    await prisma.defenseSession.delete({ where: { id: sessionId } });
    await prisma.auditLog.deleteMany({
      where: {
        entityType: "ManuscriptFeedback",
        entityId: { in: publications.map((p) => p.id) },
      },
    });
  }
  if (replacementDocumentId) {
    const document = await prisma.document.findUniqueOrThrow({
      where: { id: replacementDocumentId },
    });
    assert.equal(document.creationKey, marker);
    await prisma.documentVersion.deleteMany({
      where: { documentId: document.id },
    });
    await prisma.document.delete({ where: { id: document.id } });
  }
  await prisma.$disconnect();
}
