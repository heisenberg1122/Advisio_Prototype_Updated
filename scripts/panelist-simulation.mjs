// Run with: node --env-file=.env.demo.local scripts/panelist-simulation.mjs
import { PrismaClient } from "@prisma/client";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const marker = "ADVISIO-DEMO-LOCAL-V1";
const evaluate = process.argv.includes("--evaluate");
const sessionId = evaluate
  ? "2e07662e-9462-43b7-956b-3658d2df7302"
  : "ab1e9a43-9250-4d3c-8836-197d8b6af4b1";
const url = new URL(process.env.DATABASE_URL || "");
if (
  process.env.ADVISIO_LOCAL_DEMO !== "1" ||
  process.env.LOCAL_DEMO_EXECUTION !== "1" ||
  process.env.NODE_ENV === "production" ||
  process.env.STORAGE_PROVIDER !== "LOCAL" ||
  url.hostname !== "127.0.0.1" || url.port !== "5435" ||
  url.pathname !== "/advisio_demo_local" ||
  url.searchParams.get("schema") !== "public" ||
  url.searchParams.get("application_name") !== "advisio-demo-local" ||
  process.env.DIRECT_URL !== process.env.DATABASE_URL
) throw new Error("This simulation requires the isolated local demo database.");

const prisma = new PrismaClient();
try {
  const [identity] = await prisma.$queryRaw`
    SELECT current_database() AS database,
      current_setting('application_name') AS application
  `;
  if (identity.database !== "advisio_demo_local" || identity.application !== "advisio-demo-local")
    throw new Error("Unexpected live database identity.");
  const credentials = JSON.parse(await fs.readFile(new URL("../.demo-local/credentials.json", import.meta.url), "utf8"));
  if (credentials.datasetId !== marker) throw new Error("Unexpected demo credentials.");
  const account = credentials.accounts.find((item) => item.key === "role:panelist");
  const professorAccount = credentials.accounts.find((item) => item.key === "role:professor");
  if (!account || !professorAccount) throw new Error("Demo accounts are missing.");
  const panelist = await prisma.user.findUniqueOrThrow({ where: { email: account.email } });
  const professor = await prisma.user.findUniqueOrThrow({ where: { email: professorAccount.email } });
  const project = await prisma.researchProject.findFirstOrThrow({
    where: { groupName: `${marker}:BSIT` },
    include: { members: { where: { leftAt: null }, include: { user: true } } },
  });
  const start = new Date("2026-10-23T09:00:00+08:00");
  const end = new Date("2026-10-23T10:00:00+08:00");
  const notes = "Fictional panelist practice session. Review the research group and schedule. The professor must publish an eligible manuscript before packet review, then start the defense to enable scoring.";
  const session = await prisma.$transaction(async (tx) => {
    const existing = await tx.defenseSession.findUnique({ where: { id: sessionId } });
    if (existing) {
      if (existing.researchId !== project.id || !existing.notes?.startsWith("Fictional panelist practice session."))
        throw new Error("Simulation identifier belongs to another record.");
      return existing; // Preserve any practice actions already taken.
    }
    const event = await tx.defenseEvent.create({ data: {
      code: evaluate ? "SIM-FIRST-EVALUATION" : "SIM-PANEL-20261023", collegeId: project.collegeId,
      defenseType: "PROPOSAL_DEFENSE", status: "READY",
      scheduledStart: start, scheduledEnd: end,
      venue: "Simulation Room 201", notes, createdBy: professor.id,
    } });
    return tx.defenseSession.create({ data: {
      id: sessionId, researchId: project.id, defenseEventId: event.id,
      status: "SCHEDULED", queueStatus: "WAITING", queuePosition: 1,
      scheduledStart: start, scheduledEnd: end,
      venue: "Simulation Room 201", notes, createdBy: professor.id,
      invitations: { create: [{ inviteeId: panelist.id, role: "PANELIST", status: "ACCEPTED", respondedAt: new Date() }] },
    } });
  });
  if (evaluate) {
    // Seed a clearly fictional packet using a separate, checksummed byte snapshot.
    // Preserve existing manuscripts, approvals, scores, and completed sessions.
    let packet = await prisma.defensePacket.findUnique({ where: { defenseSessionId: session.id } });
    if (!packet) {
      const source = await prisma.documentVersion.findFirstOrThrow({
        where: { document: { researchId: project.id, storageProvider: "LOCAL" } },
        orderBy: { versionNumber: "desc" },
      });
      const root = path.resolve(fileURLToPath(new URL("../apps/api/uploads/local/", import.meta.url)));
      const sourcePath = path.resolve(source.storagePath);
      if (!sourcePath.startsWith(root + path.sep)) throw new Error("Expected a local fixture manuscript.");
      const bytes = await fs.readFile(sourcePath);
      const snapshotPath = path.join(root, marker.toLowerCase(), "first-evaluation-snapshot.pdf");
      try { await fs.writeFile(snapshotPath, bytes, { flag: "wx" }); }
      catch (error) { if (error.code !== "EEXIST") throw error; }
      const snapshotBytes = await fs.readFile(snapshotPath);
      const checksum = crypto.createHash("sha256").update(snapshotBytes).digest("hex");
      packet = await prisma.$transaction(async (tx) => {
        const document = await tx.document.create({ data: {
          researchId: project.id, milestoneId: source.milestoneId,
          documentType: "MANUSCRIPT", title: "Fictional first-evaluation practice manuscript",
          storageProvider: "LOCAL", createdBy: professor.id,
          creationKey: "local-demo-first-evaluation", lifecycleStatus: "SUBMITTED",
          versions: { create: {
            versionNumber: 1, fileName: "first-evaluation-snapshot.pdf",
            mimeType: "application/pdf", fileSize: snapshotBytes.length,
            storagePath: snapshotPath, uploadedBy: professor.id,
            milestoneId: source.milestoneId, isImmutable: true,
            contentChecksum: checksum, submittedAt: new Date(), snapshotCreatedAt: new Date(),
            submittedBy: professor.id, submissionKey: "local-demo-first-evaluation-snapshot",
            manuscriptStatus: "SUBMITTED",
          } },
        }, include: { versions: true } });
        return tx.defensePacket.create({ data: {
          defenseSessionId: session.id, manuscriptVersionId: document.versions[0].id,
          publishedById: professor.id, status: "PUBLISHED", publishedAt: new Date(),
          preflightReport: { simulation: true, description: "Fictional published packet fixture for first-time scoring; no institutional approval is asserted." },
        } });
      });
    }
    const existingScores = await prisma.evaluation.count({ where: { defenseSessionId: session.id } });
    if (session.status === "SCHEDULED" && existingScores === 0) {
      const loginResponse = await fetch("http://127.0.0.1:5055/api/auth/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: professorAccount.email, password: professorAccount.password }),
      });
      const login = await loginResponse.json();
      if (!loginResponse.ok || !login.token) throw new Error("Demo professor login failed.");
      const response = await fetch("http://127.0.0.1:5055/api/defense-sessions/start", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${login.token}` },
        body: JSON.stringify({ sessionId: session.id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to start practice defense.");
      session.status = result.session.status;
    }
    console.log(JSON.stringify({ practice: "First evaluation", sessionId: session.id,
      status: session.status, existingEvaluations: existingScores,
      url: `http://localhost:3000/panelist/dashboard?tab=evaluation&sessionId=${session.id}`,
    }));
  }
  await fs.writeFile(new URL("../.demo-local/panelist-simulation-login.txt", import.meta.url),
    `Advisio panelist simulation (local demo only)\n\nSign in: http://localhost:3000/login\nEmail: ${account.email}\nPassword: ${account.password}\n\nSchedule: http://localhost:3000/panelist/dashboard?tab=schedule\nSession: http://localhost:3000/panelist/defenses/${session.id}\n\nProfessor login is available under role:professor in credentials.json.\n`, { mode: 0o600 });
  const researchers = project.members.filter((item) => ["LEADER", "MEMBER"].includes(item.projectRole));
  console.log(JSON.stringify({ sessionId: session.id, title: project.title,
    status: session.status, schedule: "October 23, 2026, 9:00–10:00 AM Asia/Manila",
    venue: session.venue, panelist: account.email,
    researchers: researchers.map((item) => `${item.user.firstName} ${item.user.lastName}`),
    credentialsFile: ".demo-local/panelist-simulation-login.txt",
    packet: evaluate ? "Fictional practice packet published" : "Awaiting professor publication",
    evaluation: evaluate ? "Start your first evaluation; previous practice work is preserved" : "Unlocks when professor starts defense",
  }, null, 2));
} finally { await prisma.$disconnect(); }
