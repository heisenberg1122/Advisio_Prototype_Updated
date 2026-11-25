import type { PrismaClient, DocumentVersion } from "@prisma/client";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { evaluationContext } from "./context.js";
import { demoEvaluationForm, evaluationAsset } from "./branding.js";
import type { EvaluationCourse, EvaluationRole, Scenario } from "./catalog.js";
import type { ManuscriptCourse } from "./manuscript.js";
import { DocumentSigningService } from "../services/document-signing.service.js";
import {
  scoreStructuredEvaluation,
  renderStructuredEvaluation,
  evaluationPdfHash,
  type FormSnapshot,
} from "../services/structured-evaluation.service.js";
import {
  appendEvaluationEvent,
  submissionPayload,
  releasePayload,
  loadEvaluationIntegrity,
  assertEvaluationIntegrity,
} from "../services/evaluation-ledger.service.js";
import {
  canIssueDefenseBadge,
  defenseBadgeKind,
} from "../services/defense-badge-policy.js";
import {
  certificateBadgeInclude,
  certificateResearchInclude,
  issueDefenseCertificates,
} from "../services/defense-certificate.service.js";
import {
  renderAnnotatedPdf,
  pdfHash,
  evaluationRevisionHash,
} from "../services/pdf-annotation.service.js";

const hash = (buffer: Uint8Array) =>
  createHash("sha256").update(buffer).digest("hex");
type Input = {
  db: PrismaClient;
  course: EvaluationCourse;
  projectCourse: ManuscriptCourse;
  scenario: Scenario;
  projectId: string;
  collegeId: string;
  users: Record<EvaluationRole, string>;
  otherPanelist: string;
  roster: string[];
  stages: { id: string }[];
  latest: DocumentVersion;
  previous: DocumentVersion;
  storageRoot: string;
  day: (n: number) => Date;
};

export async function approvalLetter(course: EvaluationCourse, title: string) {
  const form = await demoEvaluationForm(course);
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage([612, 792]);
  const logo = await pdf.embedPng(
    Buffer.from(form.branding!.collegeLogo.split(",")[1], "base64"),
  );
  const scale = 60 / Math.max(logo.width, logo.height);
  page.drawImage(logo, {
    x: 498,
    y: 686,
    width: logo.width * scale,
    height: logo.height * scale,
  });
  let y = 735;
  const write = (value: string, heavy = false) => {
    const font = heavy ? bold : regular;
    let line = "";
    for (const word of value.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, 11) > 450 && line) {
        page.drawText(line, { x: 48, y, size: 11, font });
        y -= 17;
        line = word;
      } else line = next;
    }
    if (line) page.drawText(line, { x: 48, y, size: 11, font });
    y -= 29;
  };
  write("UNIVERSITY OF THE ASSUMPTION", true);
  write(course.college);
  y -= 18;
  write("DEFENSE APPROVAL REQUEST", true);
  write("FICTIONAL EVALUATION SAMPLE - DEMO USE ONLY", true);
  write(`Research project: ${title}`);
  write("To: Aurelia Mendoza, fictional College Dean");
  write("From: Paolo Villanueva, fictional Research Coordinator");
  write(
    "The required manuscript and workflow eligibility have been reviewed. Please inspect the attached research record and sign this request for the indicated defense cycle.",
  );
  write(
    "This document and its signature are fictional evaluation materials. They do not authorize a real defense or represent a real Dean's signature.",
  );
  page.drawRectangle({
    x: 334,
    y: 100,
    width: 230,
    height: 120,
    borderColor: rgb(0.5, 0.6, 0.7),
    borderWidth: 1,
  });
  page.drawText("Demo Dean approval / signature", {
    x: 344,
    y: 204,
    font: regular,
    size: 9,
  });
  page.drawText("ADVISIO | Fictional evaluation sample", {
    x: 48,
    y: 35,
    font: regular,
    size: 9,
  });
  return Buffer.from(await pdf.save());
}

async function seedApproval(
  input: Input,
  milestoneId: string,
  signed: boolean,
  at: Date,
  suffix: string,
) {
  const {
    db,
    projectId,
    users,
    storageRoot,
    collegeId,
    course,
    projectCourse,
  } = input;
  const title = `${suffix} defense approval request - fictional sample`;
  const buffer = await approvalLetter(course, projectCourse.title);
  const fileName = `${course.short}_${input.scenario}_${suffix}_Approval.pdf`;
  const storagePath = path.join(storageRoot, fileName);
  await fs.writeFile(storagePath, buffer, { flag: "wx" });
  const document = await db.document.create({
    data: {
      researchId: projectId,
      milestoneId,
      title,
      documentType: "DEAN_DEFENSE_APPROVAL",
      storageProvider: "LOCAL",
      createdBy: users.professor,
    },
  });
  const version = await db.documentVersion.create({
    data: {
      documentId: document.id,
      versionNumber: 1,
      fileName,
      mimeType: "application/pdf",
      fileSize: BigInt(buffer.length),
      storagePath,
      uploadedBy: users.professor,
      uploadedAt: new Date(+at - 86_400_000),
      status: "ACTIVE",
      contentChecksum: hash(buffer),
    },
  });
  await db.deanInboxMessage.create({
    data: {
      documentId: document.id,
      authorId: users.professor,
      recipientId: users.dean,
      attachmentVersionId: version.id,
      message: `Fictional Coordinator request: please review and sign this ${suffix.toLowerCase()} defense approval for ${projectCourse.title}.`,
      createdAt: new Date(+at - 86_400_000),
    },
  });
  if (signed)
    await evaluationContext.run(
      { id: path.basename(storageRoot), prisma: db, storageRoot },
      () =>
        new DocumentSigningService(() => at).sign({
          sourceVersionId: version.id,
          signerId: users.dean,
          signerRoles: ["DEAN"],
          signerCollegeId: collegeId,
          placements: [
            {
              pageNumber: 1,
              x: 0.57,
              y: 0.74,
              width: 0.34,
              height: 0.08,
              includeName: true,
              includeDate: true,
            },
          ],
        }),
    );
  return document.id;
}

async function publishSampleFeedback(
  input: Input,
  sessionId: string,
  version: DocumentVersion,
  at: Date,
) {
  const { db, users } = input;
  const sourceData = await fs.readFile(version.storagePath);
  const annotations = [
    {
      id: randomUUID(),
      type: "comment" as const,
      page: 2,
      x: 0.12,
      y: 0.25,
      width: 0.45,
      height: 0.05,
      text: `Fictional prior panel review: ${input.course.revision}`,
    },
  ];
  const checksum = pdfHash(sourceData);
  const previewHash = evaluationRevisionHash({
    sourceChecksum: checksum,
    annotations,
    revision: 1,
  });
  const review = await db.packetDocumentReview.create({
    data: {
      defenseSessionId: sessionId,
      panelistId: users.panelist,
      sourceVersionId: version.id,
      sourceData: Uint8Array.from(sourceData),
      sourceChecksum: checksum,
      annotations,
      revision: 1,
      previewHash,
      createdAt: at,
      updatedAt: at,
    },
  });
  const bytes = await renderAnnotatedPdf(sourceData, annotations);
  await db.packetReviewPublication.create({
    data: {
      reviewId: review.id,
      revision: 1,
      pdfData: Uint8Array.from(bytes),
      integrityHash: pdfHash(bytes),
      publishedAt: at,
    },
  });
}

async function cycle(
  input: Input,
  finalDefense: boolean,
  completed: boolean,
  source: DocumentVersion,
  previous: DocumentVersion,
  daysAgo: number,
) {
  const {
    db,
    users,
    projectId,
    course,
    projectCourse,
    roster,
    stages,
    day,
    scenario,
    otherPanelist,
  } = input;
  const gate = finalDefense ? 8 : 3;
  const approvedAt = day(daysAgo - 3),
    startedAt = day(daysAgo),
    endedAt = day(daysAgo + 1 / 24),
    releasedAt = day(daysAgo + 1);
  const approvalId = await seedApproval(
    input,
    stages[gate].id,
    true,
    day(daysAgo - 2),
    finalDefense ? "Final" : "Title",
  );
  const eligibility = await db.defenseEligibility.create({
    data: {
      researchId: projectId,
      milestoneId: stages[gate].id,
      approvedBy: users.professor,
      approvedAt,
      consumedAt: completed ? releasedAt : null,
      deanApprovalDocumentId: approvalId,
    },
  });
  const event = await db.defenseEvent.create({
    data: {
      code: `DEMO-${scenario}-${finalDefense ? "FINAL" : "TITLE"}`,
      collegeId: input.collegeId,
      defenseType: finalDefense ? "FINAL_DEFENSE" : "TITLE_DEFENSE",
      status: completed ? "COMPLETED" : scenario === "E" ? "ONGOING" : "READY",
      scheduledStart: completed
        ? startedAt
        : scenario === "E"
          ? day(0)
          : day(1),
      scheduledEnd: completed
        ? endedAt
        : scenario === "E"
          ? day(1 / 24)
          : day(1 + 1 / 24),
      venue: `${course.collegeCode} Research Presentation Room`,
      createdBy: users.professor,
      startedAt: completed || scenario === "E" ? startedAt : null,
      completedAt: completed ? endedAt : null,
      notes: "Fictional evaluation sample.",
    },
  });
  const session = await db.defenseSession.create({
    data: {
      researchId: projectId,
      eligibilityId: eligibility.id,
      defenseEventId: event.id,
      queuePosition: 1,
      status: completed ? "COMPLETED" : scenario === "E" ? "LIVE" : "SCHEDULED",
      queueStatus: completed
        ? "COMPLETED"
        : scenario === "E"
          ? "IN_PROGRESS"
          : "WAITING",
      venue: event.venue,
      scheduledStart: event.scheduledStart,
      scheduledEnd: event.scheduledEnd,
      createdBy: users.professor,
      preparedAt: approvedAt,
      startedAt: completed || scenario === "E" ? startedAt : null,
      startedBy: completed || scenario === "E" ? users.professor : null,
      endedAt: completed ? endedAt : null,
      releasedAt: completed ? releasedAt : null,
      releasedBy: completed ? users.professor : null,
      decision: completed ? "APPROVED" : null,
      evaluationLedgerStartedAt: approvedAt,
      notes: completed
        ? "Fictional completed defense with submitted evaluations and released results."
        : "Fictional defense for manuscript review and evaluation practice.",
    },
  });
  await db.defenseInvitation.createMany({
    data: [
      {
        defenseSessionId: session.id,
        inviteeId: users.panelist,
        role: "PANEL_CHAIR",
        status: "ACCEPTED",
        respondedAt: approvedAt,
      },
      {
        defenseSessionId: session.id,
        inviteeId: otherPanelist,
        role: "PANELIST",
        status: "ACCEPTED",
        respondedAt: approvedAt,
      },
    ],
  });
  const spec = await demoEvaluationForm(course, finalDefense);
  const snapshot: FormSnapshot = {
    spec,
    roster: roster.map((userId, i) => ({
      userId,
      name: projectCourse.researchers[i],
    })),
    panelists: [
      { userId: users.panelist, name: "Marisol Cruz", required: true },
      { userId: otherPanelist, name: "Victor Santos", required: true },
    ],
    researchTitle: projectCourse.title,
    manuscriptVersionId: source.id,
    publishedAt: approvedAt.toISOString(),
  };
  await db.defensePacket.create({
    data: {
      defenseSessionId: session.id,
      manuscriptVersionId: source.id,
      publishedById: users.professor,
      publishedAt: approvedAt,
      status: "PUBLISHED",
      evaluationMode: "STRUCTURED",
      structuredForm: JSON.parse(JSON.stringify(snapshot)),
      evaluationSignatureRequired: false,
    },
  });
  await db.$transaction((tx) =>
    appendEvaluationEvent(tx, {
      sessionId: session.id,
      eventType: "FORM_PUBLISHED",
      actorId: users.professor,
      actorRoles: ["RESEARCH_COORDINATOR"],
      operationId: `form:${session.id}:1`,
      payload: {
        snapshot,
        mappingVersion: 1,
        publicationReason: "Fictional evaluation sample.",
      },
    }),
  );
  for (const panel of snapshot.panelists.filter(
    (p) => completed || (scenario === "E" && p.userId === otherPanelist),
  )) {
    const scored = scoreStructuredEvaluation(
      snapshot,
      {
        researchers: Object.fromEntries(
          roster.map((id) => [
            id,
            { clarity: 3, response: panel.userId === otherPanelist ? 4 : 3 },
          ]),
        ),
        manuscript: { scope: 3, method: 3, organization: 4 },
        recommendation: "APPROVED",
        feedback: `Fictional panel feedback by ${panel.name}: ${course.revision}`,
        signature: "",
      },
      true,
    );
    const bytes = await renderStructuredEvaluation(
      snapshot,
      scored.answers,
      panel.name,
    );
    const record = await db.structuredEvaluation.create({
      data: {
        defenseSessionId: session.id,
        panelistId: panel.userId,
        revision: 1,
        answers: JSON.parse(JSON.stringify(scored.answers)),
        totals: JSON.parse(JSON.stringify(scored.totals)),
        lockedAt: completed ? endedAt : day(0),
        pdfData: Uint8Array.from(bytes),
        previewHash: evaluationPdfHash(bytes),
      },
    });
    await db.$transaction((tx) =>
      appendEvaluationEvent(tx, {
        sessionId: session.id,
        eventType: "EVALUATION_SUBMITTED",
        actorId: panel.userId,
        actorRoles: ["PANELIST"],
        operationId: `evaluation:${record.id}:1`,
        payload: submissionPayload(record),
      }),
    );
  }
  if (completed) {
    await db.panelistManuscriptReview.create({
      data: {
        defenseSessionId: session.id,
        panelistId: users.panelist,
        reviewedAt: approvedAt,
        privateNotes: `Fictional completed manuscript review. ${course.feedback}`,
      },
    });
    await publishSampleFeedback(input, session.id, source, approvedAt);
    await db.$transaction(async (tx) => {
      const { state, events } = await loadEvaluationIntegrity(tx, session.id);
      await appendEvaluationEvent(tx, {
        sessionId: session.id,
        eventType: "RESULT_RELEASED",
        actorId: users.professor,
        actorRoles: ["RESEARCH_COORDINATOR"],
        operationId: `release:${session.id}`,
        payload: releasePayload(
          state,
          events,
          "Fictional completed evaluation; all required panelists submitted.",
        ),
      });
      const checked = await loadEvaluationIntegrity(tx, session.id);
      assertEvaluationIntegrity(checked.verification);
    });
    if (!canIssueDefenseBadge({ ...session, defenseEvent: event }))
      throw new Error("Seeded defense is not eligible for a badge.");
    const badge = await db.defenseBadge.create({
      data: {
        defenseSessionId: session.id,
        kind: defenseBadgeKind(event.defenseType)!,
        issuedBy: users.professor,
        issuedAt: releasedAt,
        recipients: snapshot.roster,
      },
      include: certificateBadgeInclude,
    });
    if (badge.kind === "FINAL_DEFENSE") {
      const [research, dean] = await Promise.all([
        db.researchProject.findUniqueOrThrow({ where: { id: projectId }, include: certificateResearchInclude }),
        db.user.findUniqueOrThrow({
          where: { id: users.dean },
          select: { firstName: true, lastName: true },
        }),
      ]);
      await issueDefenseCertificates(db, badge, research, dean);
    }
    await db.auditLog.create({
      data: {
        userId: users.professor,
        action: "CREATE",
        entityType: "DefenseBadge",
        researchId: projectId,
        entityId: badge.id,
        newValues: {
          defenseSessionId: session.id,
          kind: badge.kind,
          fictional: true,
        },
      },
    });
  } else if (scenario === "E") {
    await publishSampleFeedback(input, session.id, previous, day(-2));
    await db.panelistManuscriptReview.create({
      data: {
        defenseSessionId: session.id,
        panelistId: users.panelist,
        privateNotes:
          "Fictional earlier-version feedback is shared. The current revised manuscript is pending review.",
        reviewedAt: null,
      },
    });
  }
  return { defenseId: session.id, approvalId };
}

export async function seedDefenseScenario(input: Input) {
  if (input.scenario === "G") {
    const approvalId = await seedApproval(
      input,
      input.stages[3].id,
      false,
      input.day(-1),
      "Title",
    );
    await input.db.defenseEligibility.create({
      data: {
        researchId: input.projectId,
        milestoneId: input.stages[3].id,
        approvedBy: input.users.professor,
        approvedAt: input.day(-3),
        deanApprovalDocumentId: approvalId,
      },
    });
    await fs.writeFile(
      path.join(input.storageRoot, "Prepared_Defense_Approval_Request.pdf"),
      await approvalLetter(input.course, input.projectCourse.title),
      { flag: "wx" },
    );
    return { defenseId: null, approvalId };
  }
  if (input.scenario === "F") {
    const titleSource = await input.db.documentVersion.findFirstOrThrow({
      where: {
        document: {
          researchId: input.projectId,
          milestoneId: input.stages[3].id,
        },
      },
      orderBy: { versionNumber: "desc" },
    });
    await cycle(input, false, true, titleSource, titleSource, -10);
  }
  return cycle(
    input,
    input.scenario === "F",
    input.scenario === "D" || input.scenario === "F",
    input.latest,
    input.previous,
    input.scenario === "E" ? 0 : -4,
  );
}
