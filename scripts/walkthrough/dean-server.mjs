// Loopback-only recording fixture. Native app authentication and permissions remain in force.
import fs from "node:fs/promises";
import path from "node:path";
import { randomBytes, createHash } from "node:crypto";
import { spawn } from "node:child_process";
import dotenv from "dotenv";
import pg from "pg";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { root, writeJson, readJson } from "./common.mjs";

const directory = path.join(root, ".walkthrough/dean");
await fs.mkdir(directory, { recursive: true });
const config = dotenv.parse(await fs.readFile(path.join(root, ".env.evaluation.local")));
const registryUrl = new URL(config.EVALUATION_DATABASE_URL);
if (registryUrl.hostname !== "127.0.0.1" || registryUrl.port !== "5436" || registryUrl.pathname !== "/advisio_evaluation" || registryUrl.searchParams.get("application_name") !== "advisio-evaluation") throw new Error("Recording requires the dedicated local demo cluster.");
const manifestFile = path.join(directory, "demo.json");
let demo = await readJson(manifestFile).catch(() => null);
if (process.argv.includes("--fresh")) demo = null; // A new schema; never deletes an existing fixture.
const schema = demo?.schema || `walkthrough_dean_${randomBytes(8).toString("hex")}`;
if (!/^walkthrough_dean_[a-f0-9]{16}$/.test(schema)) throw new Error("Invalid recording schema.");
registryUrl.searchParams.set("schema", schema);
const databaseUrl = registryUrl.toString();
// Populate empty values before imports so dotenv cannot load real service credentials.
for (const file of [".env", "apps/api/.env", "packages/database/.env"])
  for (const name of Object.keys(dotenv.parse(await fs.readFile(path.join(root, file)).catch(() => "")))) process.env[name] = "";
for (const name of Object.keys(process.env)) if (/^(GOOGLE_|VITE_GOOGLE_|GMAIL_|SUPABASE_|RESEND_|SMTP_|ALLOW_DEMO_|ALLOW_THEME_DEMO_)/.test(name)) process.env[name] = "";
Object.assign(process.env, {
  NODE_ENV: "development", ADVISIO_EVALUATION: "0", ADVISIO_LOCAL_DEMO: "0",
  DATABASE_URL: databaseUrl, DIRECT_URL: databaseUrl, JWT_SECRET: demo?.jwt || randomBytes(48).toString("hex"),
  STORAGE_PROVIDER: "LOCAL", EMAIL_PROVIDER: "disabled", NOTIFICATION_EMAILS_ENABLED: "false", DEADLINE_EMAILS_ENABLED: "false",
  WEB_URL: "http://localhost:3200", CORS_ORIGIN: "http://localhost:3200", PORT: "5200",
  VITE_API_URL: "", VITE_API_PROXY: "http://127.0.0.1:5200", VITE_GOOGLE_SIGN_IN_CLIENT_ID: "",
});
const db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
if (!demo) {
  const pool = new pg.Pool({ connectionString: config.EVALUATION_DATABASE_URL });
  const sql = (await fs.readFile(path.join(root, ".evaluation/schema.sql"), "utf8")).replace(/CREATE SCHEMA IF NOT EXISTS "public";/g, "").replace(/CREATE EXTENSION IF NOT EXISTS "[a-z]+";/g, "");
  const connection = await pool.connect();
  try {
    await connection.query("BEGIN");
    await connection.query(`CREATE SCHEMA "${schema}"; SET LOCAL search_path TO "${schema}", public`);
    await connection.query(sql); await connection.query("COMMIT");
  } catch (error) { await connection.query("ROLLBACK"); throw error; }
  finally { connection.release(); await pool.end(); }
  const { seedWorkspace } = await import("../../apps/api/src/evaluation/seed.ts");
  const { EVALUATION_COURSES } = await import("../../apps/api/src/evaluation/catalog.ts");
  const storageRoot = path.join(root, "uploads/local", schema);
  const seed = await seedWorkspace(db, EVALUATION_COURSES.find((c) => c.id === "BSIT"), "dean", storageRoot);
  const password = `Demo!${randomBytes(10).toString("hex")}9a`;
  const passwordHash = await bcrypt.hash(password, 10);
  const people = await db.user.findMany();
  for (const person of people) await db.user.update({ where: { id: person.id }, data: { email: person.email.replace("@evaluation.invalid", "@example.invalid"), passwordHash } });
  const dean = people.find((u) => u.email === "dean@evaluation.invalid");
  const professor = people.find((u) => u.email === "professor@evaluation.invalid");
  const adviser = people.find((u) => u.email === "adviser@evaluation.invalid");
  const panelist = people.find((u) => u.email === "panelist@evaluation.invalid");
  const program = await db.program.findUniqueOrThrow({ where: { id: dean.programId } });
  await db.user.update({ where: { id: dean.id }, data: { programId: null } });
  const year = await db.academicYear.findFirstOrThrow();
  const priorYear = await db.academicYear.create({ data: { name: "2025-2026", startDate: new Date("2025-08-01"), endDate: new Date("2026-06-30") } });
  const altProgram = await db.program.findFirst({ where: { collegeId: dean.collegeId, id: { not: program.id } } });
  const projects = await db.researchProject.findMany({ orderBy: { groupName: "asc" } });
  if (altProgram) await db.researchProject.update({ where: { id: projects[2].id }, data: { programId: altProgram.id, academicYearId: priorYear.id } });
  await db.researchProject.update({ where: { id: projects[1].id }, data: { updatedAt: new Date(Date.now() - 35 * 86400000) } });
  const researcherRole = await db.role.findUniqueOrThrow({ where: { name: "RESEARCHER" } });
  const pending = await db.user.create({ data: { firstName: "Mika", lastName: "Santos", email: "mika.santos@example.invalid", universityId: "DEMO-2026-014", passwordHash, status: "PENDING", collegeId: dean.collegeId, programId: program.id, roles: { create: { roleId: researcherRole.id } } } });
  // Create neutral, fictional PDFs rather than including study-specific disclosures in footage.
  async function pdf(title, lines) {
    const doc = await PDFDocument.create(); const font = await doc.embedFont(StandardFonts.Helvetica); const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const page = doc.addPage([595, 842]); page.drawText("ADVISIO | Demonstration copy", { x: 48, y: 790, size: 11, font });
    page.drawText(title, { x: 48, y: 745, size: 18, font: bold }); let y = 702;
    for (const text of lines) { let row = ""; for (const word of text.split(/\s+/)) { if (font.widthOfTextAtSize(`${row} ${word}`, 11) > 490) { page.drawText(row, { x: 48, y, size: 11, font }); y -= 19; row = word; } else row += `${row ? " " : ""}${word}`; } page.drawText(row, { x: 48, y, size: 11, font }); y -= 35; }
    page.drawText("Fictional records for product orientation. No real approval is represented.", { x: 48, y: 35, size: 9, font }); return Buffer.from(await doc.save());
  }
  const versions = await db.documentVersion.findMany({ include: { document: true } });
  for (const version of versions) {
    const project = projects.find((item) => item.id === version.document.researchId);
    const bytes = await pdf("Research proposal", [project.title, `Submitted manuscript - Version ${version.versionNumber}`, "Purpose: Document campus navigation requirements and accessibility needs.", "Proposed method: Review campus routes and prepare an accessible interface prototype.", "Review focus: Align the scope, research objectives, and planned outputs.", `Prepared by ${project.groupName}. Adviser: ${adviser.firstName} ${adviser.lastName}.`]);
    await fs.writeFile(version.storagePath, bytes);
    await db.documentVersion.update({ where: { id: version.id }, data: { googleDriveFileId: `local-${version.id}`, fileSize: BigInt(bytes.length), contentChecksum: createHash("sha256").update(bytes).digest("hex") } });
  }
  const source = await db.documentVersion.findFirstOrThrow({ where: { document: { researchId: projects[0].id }, manuscriptStatus: "APPROVED" } });
  const requestPdf = await pdf("Research clearance request", ["To: Dean Aurelia Mendoza", "From: Professor Paolo Villanueva", "Please review this fictional college research clearance request and its supporting record.", "The demonstration requirements have been checked by the coordinator.", "Dean signature:", "", "Aurelia Mendoza - College Dean"]);
  const requestPath = path.join(storageRoot, "research-clearance-request.pdf"); await fs.writeFile(requestPath, requestPdf);
  const requestDoc = await db.document.create({ data: { researchId: projects[0].id, title: "Research clearance request", documentType: "DEAN_CLEARANCE", storageProvider: "LOCAL", createdBy: professor.id, lifecycleStatus: "APPROVED", versions: { create: { versionNumber: 1, fileName: "Research_Clearance_Request.pdf", mimeType: "application/pdf", fileSize: BigInt(requestPdf.length), storagePath: requestPath, googleDriveFileId: `local-${randomBytes(12).toString("hex")}`, uploadedBy: professor.id, status: "ACTIVE", manuscriptStatus: "APPROVED" } } }, include: { versions: true } });
  await db.deanInboxMessage.create({ data: { documentId: requestDoc.id, authorId: professor.id, recipientId: dean.id, attachmentVersionId: requestDoc.versions[0].id, message: "Please review the attached demonstration clearance request. The coordinator has checked the required records. Thank you." } });
  const dates = (offset) => new Date(Date.now() + offset * 86400000);
  for (const [index, project] of projects.entries()) {
    const completed = index === 2;
    const defense = await db.defenseSession.create({ data: { researchId: project.id, createdBy: professor.id, status: completed ? "COMPLETED" : index === 1 ? "NEEDS_RESCHEDULING" : "SCHEDULED", scheduledStart: dates(completed ? -5 : index === 1 ? 1 : 3), scheduledEnd: dates((completed ? -5 : index === 1 ? 1 : 3) + 1 / 24), venue: "Research Presentation Room", ...(completed ? { decision: "APPROVED_WITH_MINOR_REVISIONS", endedAt: dates(-5), releasedAt: dates(-4), releasedBy: professor.id } : {}) } });
    await db.defenseInvitation.create({ data: { defenseSessionId: defense.id, inviteeId: panelist.id, role: "PANEL_CHAIR", status: index === 1 ? "PENDING" : "ACCEPTED", respondedAt: index === 1 ? null : dates(-2) } });
    if (completed) await db.researchProject.update({ where: { id: project.id }, data: { academicYearId: year.id } });
  }
  await db.calendarEvent.create({ data: { title: "College Research Progress Review", description: "Review proposal readiness and adviser follow-up items.", type: "ACADEMIC", visibility: "COLLEGE", startsAt: dates(2), endsAt: dates(2 + 1 / 24), collegeId: dean.collegeId, createdBy: dean.id, location: "College Conference Room" } });
  const officialFile = await fs.readFile(source.storagePath);
  await db.officialCopy.create({ data: { researchId: projects[0].id, documentId: source.documentId, sourceVersionId: source.id, title: "CampusWay - Archived Research Proposal", documentType: "RESEARCH_PROPOSAL", fileName: "CampusWay_Official_Copy.pdf", fileSize: BigInt(officialFile.length), storageProvider: "LOCAL", storagePath: source.storagePath, googleDriveFileId: source.googleDriveFileId, checksum: createHash("sha256").update(officialFile).digest("hex"), verificationCode: `DEMO-${randomBytes(8).toString("hex").toUpperCase()}`, finalizedById: professor.id } });
  demo = { schema, jwt: process.env.JWT_SECRET, email: "dean@example.invalid", password, userId: dean.id, adviserId: adviser.id, programId: program.id, academicYearId: year.id, priorYearId: priorYear.id, pendingId: pending.id, projectId: seed.projectId, url: "http://localhost:3200", createdAt: new Date().toISOString() };
  await writeJson(manifestFile, demo);
  console.log("Prepared fictional Dean workspace, pending researcher, signature request, defenses, calendar and official copy.");
}
await db.$disconnect();
if (process.argv.includes("--prepare-only")) process.exit(0);
const { default: app } = await import("../../apps/api/src/app.ts");
const server = app.listen(5200, "127.0.0.1", () => console.log("Dean recording API: http://127.0.0.1:5200"));
const vite = spawn(process.execPath, [path.join(root, "node_modules/vite/bin/vite.js"), "--host", "127.0.0.1", "--port", "3200", "--strictPort", "--open", "false"], { cwd: path.join(root, "apps/web"), env: process.env, windowsHide: true, stdio: "inherit" });
const stop = () => { vite.kill(); server.close(() => process.exit()); };
process.on("SIGINT", stop); process.on("SIGTERM", stop);
