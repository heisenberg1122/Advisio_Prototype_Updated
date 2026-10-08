import crypto from "node:crypto";
import { PDFDocument, PDFFont, StandardFonts, rgb } from "pdf-lib";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { googleDriveService } from "./google-drive.service.js";
import { storageHierarchyService } from "./storage-hierarchy.service.js";
import { loadVersionFile } from "./document-signing.service.js";

export type OverflowPolicy =
  | "SHRINK"
  | "WRAP"
  | "APPENDIX"
  | "CONTINUATION_PAGE"
  | "REJECT";
export type PdfFieldMapping = {
  key: string;
  label: string;
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
  preferredFontSize: number;
  minimumFontSize: number;
  lineHeight: number;
  alignment: "LEFT" | "CENTER" | "RIGHT";
  multiline: boolean;
  maximumLines?: number;
  overflowPolicy: OverflowPolicy;
  required: boolean;
};
export type LayoutItem = {
  key: string;
  label: string;
  status:
    | "FITTED"
    | "WRAPPED"
    | "SHRUNK"
    | "MOVED_TO_APPENDIX"
    | "CONTINUED"
    | "REJECTED"
    | "MISSING";
  renderedFontSize?: number;
  renderedLines?: number;
  appendixReference?: string;
  warning?: string;
};

const ENGINE_VERSION = "2.0";
const PREVIEW_TTL_MS = 24 * 60 * 60 * 1000;
const sha256 = (value: Uint8Array | string) =>
  crypto.createHash("sha256").update(value).digest("hex");
const sourceHash = (value: unknown) => sha256(JSON.stringify(value));
const safeText = (value: string) =>
  value.replace(/[^\x09\x0A\x0D\x20-\xFF]/g, "?");

function readPath(values: Record<string, unknown>, key: string): string {
  const value = key
    .split(".")
    .reduce<any>((current, part) => current?.[part], values);
  if (Array.isArray(value))
    return value
      .map((item) =>
        typeof item === "object"
          ? Object.values(item).filter(Boolean).join(": ")
          : String(item),
      )
      .join("\n");
  return value == null ? "" : String(value);
}

function validateMappings(value: unknown): PdfFieldMapping[] {
  if (!Array.isArray(value)) return [];
  return value.map((item: any) => {
    const preferredFontSize = Number(
      item.preferredFontSize ?? item.fontSize ?? 9,
    );
    const mapping: PdfFieldMapping = {
      key: String(item.key || "").trim(),
      label: String(item.label || item.key || "").trim(),
      pageNumber: Number(item.pageNumber),
      x: Number(item.x),
      y: Number(item.y),
      width: Number(item.width ?? 0.35),
      height: Number(item.height ?? (item.multiline ? 0.12 : 0.035)),
      preferredFontSize,
      minimumFontSize: Number(
        item.minimumFontSize ?? Math.min(preferredFontSize, 8),
      ),
      lineHeight: Number(item.lineHeight ?? 1.2),
      alignment: ["CENTER", "RIGHT"].includes(
        String(item.alignment).toUpperCase(),
      )
        ? (String(item.alignment).toUpperCase() as "CENTER" | "RIGHT")
        : "LEFT",
      multiline: item.multiline === true,
      maximumLines:
        item.maximumLines == null || item.maximumLines === ""
          ? undefined
          : Number(item.maximumLines),
      overflowPolicy: [
        "SHRINK",
        "WRAP",
        "APPENDIX",
        "CONTINUATION_PAGE",
        "REJECT",
      ].includes(String(item.overflowPolicy).toUpperCase())
        ? (String(item.overflowPolicy).toUpperCase() as OverflowPolicy)
        : item.multiline
          ? "APPENDIX"
          : "SHRINK",
      required: item.required === true,
    };
    if (
      !mapping.key ||
      !Number.isInteger(mapping.pageNumber) ||
      mapping.pageNumber < 1 ||
      [mapping.x, mapping.y, mapping.width, mapping.height].some(
        (number) => !Number.isFinite(number) || number < 0 || number > 1,
      ) ||
      mapping.width <= 0 ||
      mapping.height <= 0 ||
      mapping.x + mapping.width > 1 ||
      mapping.y + mapping.height > 1 ||
      !Number.isFinite(mapping.preferredFontSize) ||
      !Number.isFinite(mapping.minimumFontSize) ||
      mapping.minimumFontSize < 6 ||
      mapping.minimumFontSize > mapping.preferredFontSize
    )
      throw new Error(
        "Every PDF field requires a key, valid page, readable font range, and a bounding box inside the page.",
      );
    return mapping;
  });
}

function splitLongWord(
  word: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
) {
  const pieces: string[] = [];
  let current = "";
  for (const character of word) {
    const candidate = current + character;
    if (current && font.widthOfTextAtSize(candidate, size) > maxWidth) {
      pieces.push(current);
      current = character;
    } else current = candidate;
  }
  if (current) pieces.push(current);
  return pieces;
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const result: string[] = [];
  for (const paragraph of safeText(text).split(/\r?\n/)) {
    const words = paragraph
      .split(/\s+/)
      .filter(Boolean)
      .flatMap((word) =>
        font.widthOfTextAtSize(word, size) > maxWidth
          ? splitLongWord(word, font, size, maxWidth)
          : [word],
      );
    if (!words.length) {
      result.push("");
      continue;
    }
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (current && font.widthOfTextAtSize(candidate, size) > maxWidth) {
        result.push(current);
        current = word;
      } else current = candidate;
    }
    if (current) result.push(current);
  }
  return result;
}

const boxesOverlap = (a: PdfFieldMapping, b: PdfFieldMapping) =>
  a.pageNumber === b.pageNumber &&
  a.x < b.x + b.width &&
  a.x + a.width > b.x &&
  a.y < b.y + b.height &&
  a.y + a.height > b.y;

async function composePdf(
  template: Buffer,
  mappings: PdfFieldMapping[],
  values: Record<string, unknown>,
) {
  const pdf = await PDFDocument.load(template, { updateMetadata: false });
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const report: LayoutItem[] = [];
  const overflow: Array<{ mapping: PdfFieldMapping; text: string }> = [];
  for (const mapping of mappings) {
    const page = pdf.getPages()[mapping.pageNumber - 1];
    if (!page)
      throw new Error(`Template page ${mapping.pageNumber} does not exist.`);
    const text = readPath(values, mapping.key).trim();
    if (!text) {
      report.push({
        key: mapping.key,
        label: mapping.label,
        status: "MISSING",
        warning: mapping.required ? "Required value is missing." : undefined,
      });
      if (mapping.required)
        throw new Error(
          `${mapping.label} is required before this PDF can be generated.`,
        );
      continue;
    }
    const pageSize = page.getSize();
    const boxWidth = mapping.width * pageSize.width;
    const boxHeight = mapping.height * pageSize.height;
    let size = mapping.preferredFontSize;
    let lines = mapping.multiline
      ? wrapText(text, font, size, boxWidth)
      : [safeText(text)];
    const fits = () =>
      lines.length <= (mapping.maximumLines || Number.MAX_SAFE_INTEGER) &&
      lines.length * size * mapping.lineHeight <= boxHeight &&
      lines.every((line) => font.widthOfTextAtSize(line, size) <= boxWidth);
    if (!fits() && mapping.overflowPolicy === "SHRINK")
      while (!fits() && size > mapping.minimumFontSize) {
        size = Math.max(mapping.minimumFontSize, size - 0.5);
        lines = mapping.multiline
          ? wrapText(text, font, size, boxWidth)
          : [safeText(text)];
      }
    if (!fits()) {
      if (["APPENDIX", "CONTINUATION_PAGE"].includes(mapping.overflowPolicy)) {
        const reference = `${mapping.overflowPolicy === "APPENDIX" ? "See Appendix" : "Continued"} — ${mapping.label}`;
        overflow.push({ mapping, text });
        size = Math.max(mapping.minimumFontSize, 7);
        lines = wrapText(reference, font, size, boxWidth).slice(
          0,
          Math.max(1, Math.floor(boxHeight / 9)),
        );
        report.push({
          key: mapping.key,
          label: mapping.label,
          status:
            mapping.overflowPolicy === "APPENDIX"
              ? "MOVED_TO_APPENDIX"
              : "CONTINUED",
          renderedFontSize: size,
          renderedLines: lines.length,
          appendixReference: reference,
          warning: "Full content was preserved on a continuation page.",
        });
      } else {
        report.push({
          key: mapping.key,
          label: mapping.label,
          status: "REJECTED",
          warning: "Content does not fit the configured field.",
        });
        throw new Error(
          `${mapping.label} does not fit its configured PDF area. Update the template mapping or choose an appendix overflow policy.`,
        );
      }
    } else
      report.push({
        key: mapping.key,
        label: mapping.label,
        status:
          size < mapping.preferredFontSize
            ? "SHRUNK"
            : lines.length > 1
              ? "WRAPPED"
              : "FITTED",
        renderedFontSize: size,
        renderedLines: lines.length,
        ...(size < mapping.preferredFontSize
          ? {
              warning: `Font reduced from ${mapping.preferredFontSize} pt to ${size} pt.`,
            }
          : {}),
      });
    const x = mapping.x * pageSize.width;
    const top = pageSize.height - mapping.y * pageSize.height;
    lines.forEach((line, index) => {
      const lineWidth = font.widthOfTextAtSize(line, size);
      const alignedX =
        mapping.alignment === "CENTER"
          ? x + Math.max(0, (boxWidth - lineWidth) / 2)
          : mapping.alignment === "RIGHT"
            ? x + Math.max(0, boxWidth - lineWidth)
            : x;
      page.drawText(line, {
        x: alignedX,
        y: top - size - index * size * mapping.lineHeight,
        size,
        font,
        color: rgb(0.08, 0.12, 0.18),
        maxWidth: boxWidth,
      });
    });
  }
  for (let index = 0; index < overflow.length; index++) {
    const item = overflow[index];
    const baseSize = pdf.getPages()[0].getSize();
    let page = pdf.addPage([baseSize.width, baseSize.height]);
    let y = baseSize.height - 54;
    page.drawText(
      `Appendix ${String.fromCharCode(65 + index)} — ${safeText(item.mapping.label)}`,
      { x: 48, y, size: 14, font: bold, color: rgb(0.08, 0.22, 0.32) },
    );
    y -= 25;
    for (const line of wrapText(item.text, font, 10, baseSize.width - 96)) {
      if (y < 50) {
        page = pdf.addPage([baseSize.width, baseSize.height]);
        y = baseSize.height - 54;
        page.drawText(`${safeText(item.mapping.label)} — continued`, {
          x: 48,
          y,
          size: 11,
          font: bold,
        });
        y -= 24;
      }
      page.drawText(line, {
        x: 48,
        y,
        size: 10,
        font,
        color: rgb(0.08, 0.12, 0.18),
      });
      y -= 13;
    }
  }
  pdf.setProducer(`Advisio Defense Packet Engine ${ENGINE_VERSION}`);
  pdf.setModificationDate(new Date());
  return {
    buffer: Buffer.from(await pdf.save()),
    report: {
      engineVersion: ENGINE_VERSION,
      fields: report,
      appendedPages: overflow.length,
      generatedAt: new Date().toISOString(),
    },
  };
}

export const composeMappedPdf = composePdf;

export class DefensePacketService {
  normalizeMappings = validateMappings;
  async preflight(
    templateVersion: { googleDriveFileId: string | null; storagePath: string },
    input: unknown,
  ) {
    const mappings = validateMappings(input);
    const errors: string[] = [];
    const warnings: string[] = [];
    if (!mappings.length) errors.push("Map at least one field.");
    const pdf = await PDFDocument.load(await loadVersionFile(templateVersion), {
      updateMetadata: false,
    });
    const pageCount = pdf.getPageCount();
    mappings.forEach((mapping) => {
      if (mapping.pageNumber > pageCount)
        errors.push(
          `${mapping.label} points to missing page ${mapping.pageNumber}.`,
        );
      if (mapping.minimumFontSize < 8)
        warnings.push(
          `${mapping.label} permits text smaller than the recommended 8 pt.`,
        );
    });
    for (let i = 0; i < mappings.length; i++)
      for (let j = i + 1; j < mappings.length; j++)
        if (boxesOverlap(mappings[i], mappings[j]))
          warnings.push(`${mappings[i].label} overlaps ${mappings[j].label}.`);
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      pageCount,
      mappingCount: mappings.length,
      engineVersion: ENGINE_VERSION,
      checkedAt: new Date().toISOString(),
    };
  }

  private async recommendationContext(sessionId: string, panelistId: string) {
    const session = await prisma.defenseSession.findUnique({
      where: { id: sessionId },
      include: {
        research: true,
        invitations: true,
        packet: { include: { recommendationTemplate: true } },
      },
    });
    if (!session?.packet || session.packet.status !== "PUBLISHED")
      throw new Error(
        "The professor has not published a defense review packet.",
      );
    if (
      !session.invitations.some(
        (item) =>
          item.inviteeId === panelistId &&
          item.status === "ACCEPTED" &&
          ["PANELIST", "PANEL_CHAIR"].includes(item.role),
      )
    )
      throw new Error("You are not an accepted panelist for this defense.");
    if (!session.packet.recommendationTemplate)
      throw new Error("A recommendation PDF template has not been configured.");
    const panelist = await prisma.user.findUnique({
      where: { id: panelistId },
      select: { firstName: true, middleName: true, lastName: true },
    });
    return {
      session,
      template: session.packet.recommendationTemplate,
      mappings: validateMappings(session.packet.recommendationFieldMappings),
      panelistName: panelist
        ? [panelist.firstName, panelist.middleName, panelist.lastName]
            .filter(Boolean)
            .join(" ")
        : "",
    };
  }
  private recommendationPayload(
    context: Awaited<ReturnType<DefensePacketService["recommendationContext"]>>,
    responses: Record<string, unknown>,
    generatedAt = new Date(),
  ) {
    return {
      ...responses,
      panelistName: context.panelistName,
      researchTitle: context.session.research.title,
      defenseDate:
        context.session.scheduledStart?.toLocaleDateString("en-PH") || "",
      generatedAt: generatedAt.toLocaleString("en-PH", {
        timeZone: "Asia/Manila",
      }),
    };
  }

  async saveRecommendationDraft(
    sessionId: string,
    panelistId: string,
    responses: Record<string, unknown>,
  ) {
    await this.recommendationContext(sessionId, panelistId);
    const existing = await prisma.panelistRecommendation.findUnique({
      where: {
        defenseSessionId_panelistId: {
          defenseSessionId: sessionId,
          panelistId,
        },
      },
    });
    if (existing?.status === "LOCKED")
      throw new Error("The final recommendation is locked.");
    return prisma.panelistRecommendation.upsert({
      where: {
        defenseSessionId_panelistId: {
          defenseSessionId: sessionId,
          panelistId,
        },
      },
      create: {
        defenseSessionId: sessionId,
        panelistId,
        responses: responses as any,
        status: "DRAFT",
      },
      update: {
        responses: responses as any,
        previewData: null,
        previewSourceHash: null,
        previewLayoutReport: Prisma.DbNull,
        previewGeneratedAt: null,
      },
      include: { generatedVersion: true },
    });
  }
  async previewRecommendation(sessionId: string, panelistId: string) {
    const context = await this.recommendationContext(sessionId, panelistId);
    const recommendation = await prisma.panelistRecommendation.findUnique({
      where: {
        defenseSessionId_panelistId: {
          defenseSessionId: sessionId,
          panelistId,
        },
      },
    });
    if (!recommendation || recommendation.status === "LOCKED")
      throw new Error(
        recommendation
          ? "The final recommendation is already locked."
          : "Save the recommendation draft before generating a preview.",
      );
    const previewTime = new Date();
    const result = await composePdf(
      await loadVersionFile(context.template),
      context.mappings,
      this.recommendationPayload(
        context,
        recommendation.responses as Record<string, unknown>,
        previewTime,
      ),
    );
    const hash = sourceHash(recommendation.responses);
    const updated = await prisma.panelistRecommendation.update({
      where: { id: recommendation.id },
      data: {
        previewData: result.buffer,
        previewSourceHash: hash,
        previewLayoutReport: result.report as any,
        previewGeneratedAt: previewTime,
      },
    });
    return {
      previewUrl: `/api/defense-sessions/${sessionId}/recommendation/preview`,
      layoutReport: result.report,
      sourceHash: hash,
      generatedAt: updated.previewGeneratedAt,
    };
  }
  async getRecommendationPreview(sessionId: string, panelistId: string) {
    const recommendation = await prisma.panelistRecommendation.findUnique({
      where: {
        defenseSessionId_panelistId: {
          defenseSessionId: sessionId,
          panelistId,
        },
      },
    });
    if (
      !recommendation?.previewData ||
      !recommendation.previewGeneratedAt ||
      Date.now() - recommendation.previewGeneratedAt.getTime() > PREVIEW_TTL_MS
    )
      throw new Error("Generate a recommendation preview first.");
    return Buffer.from(recommendation.previewData);
  }
  async confirmRecommendation(sessionId: string, panelistId: string) {
    const context = await this.recommendationContext(sessionId, panelistId);
    const recommendation = await prisma.panelistRecommendation.findUnique({
      where: {
        defenseSessionId_panelistId: {
          defenseSessionId: sessionId,
          panelistId,
        },
      },
    });
    if (!recommendation || recommendation.status === "LOCKED")
      throw new Error(
        recommendation
          ? "The final recommendation is already locked."
          : "Save and preview the recommendation first.",
      );
    if (
      !recommendation.previewData ||
      !recommendation.previewGeneratedAt ||
      Date.now() - recommendation.previewGeneratedAt.getTime() >
        PREVIEW_TTL_MS ||
      recommendation.previewSourceHash !== sourceHash(recommendation.responses)
    )
      throw new Error(
        "The preview is missing or outdated. Generate a new preview before locking.",
      );
    const result = await composePdf(
      await loadVersionFile(context.template),
      context.mappings,
      this.recommendationPayload(
        context,
        recommendation.responses as Record<string, unknown>,
        recommendation.previewGeneratedAt || new Date(),
      ),
    );
    const folderId = await storageHierarchyService.resolveFolder({
      researchId: context.session.researchId,
      bucket: "SUBMISSIONS",
    });
    const stored = await googleDriveService.uploadFile({
      fileName: `panel-recommendation-${panelistId.slice(0, 8)}-${Date.now()}.pdf`,
      mimeType: "application/pdf",
      buffer: result.buffer,
      folderId,
      description: `Panel recommendation for ${context.session.research.title}`,
      appProperties: {
        advisioManaged: "true",
        advisioResearchId: context.session.researchId,
        advisioDefenseSessionId: sessionId,
        advisioPanelistId: panelistId,
        advisioLifecycle: "PANEL_RECOMMENDATION",
        advisioSourceHash: recommendation.previewSourceHash,
      },
    });
    const document = await prisma.document.create({
      data: {
        researchId: context.session.researchId,
        documentType: "PANEL_RECOMMENDATION",
        title: "Panelist Recommendation",
        createdBy: panelistId,
      },
    });
    const version = await prisma.documentVersion.create({
      data: {
        documentId: document.id,
        versionNumber: 1,
        fileName: stored.fileName,
        mimeType: "application/pdf",
        fileSize: BigInt(stored.sizeBytes),
        storagePath: stored.webViewLink || stored.storagePath,
        googleDriveFileId: stored.fileId,
        uploadedBy: panelistId,
      },
    });
    return prisma.panelistRecommendation.update({
      where: { id: recommendation.id },
      data: {
        status: "LOCKED",
        generatedVersionId: version.id,
        integrityHash: sha256(result.buffer),
        submittedAt: new Date(),
        previewData: null,
        previewLayoutReport: result.report as any,
        generationMetadata: {
          engineVersion: ENGINE_VERSION,
          templateVersionId: context.template.id,
          mappingVersion: context.session.packet!.mappingVersion,
          mappingSnapshot: context.mappings,
          sourceResponseHash: recommendation.previewSourceHash,
          layoutReport: result.report,
        } as any,
      },
      include: { generatedVersion: true },
    });
  }

  async generateEvaluation(
    sessionId: string,
    panelistId: string,
    evaluation: any,
  ) {
    const session = await prisma.defenseSession.findUnique({
      where: { id: sessionId },
      include: {
        research: true,
        packet: { include: { evaluationTemplate: true } },
      },
    });
    const template = session?.packet?.evaluationTemplate;
    const mappings = validateMappings(session?.packet?.evaluationFieldMappings);
    if (
      !session ||
      session.packet?.status !== "PUBLISHED" ||
      !template ||
      !mappings.length
    )
      return null;
    const panelist = await prisma.user.findUnique({
      where: { id: panelistId },
      select: { firstName: true, middleName: true, lastName: true },
    });
    const criteria = Object.fromEntries(
      (Array.isArray(evaluation.criteriaScores)
        ? evaluation.criteriaScores
        : []
      ).map((item: any) => [item.criterionId, item]),
    );
    const values = {
      researchTitle: session.research.title,
      panelistName: panelist
        ? [panelist.firstName, panelist.middleName, panelist.lastName]
            .filter(Boolean)
            .join(" ")
        : "",
      totalScore: evaluation.totalScore,
      recommendation: String(evaluation.recommendation || "").replace(
        /_/g,
        " ",
      ),
      remarks: evaluation.remarks || "",
      criteria,
      defenseDate: session.scheduledStart?.toLocaleDateString("en-PH") || "",
      submittedAt: new Date().toLocaleString("en-PH", {
        timeZone: "Asia/Manila",
      }),
    };
    const result = await composePdf(
      await loadVersionFile(template),
      mappings,
      values,
    );
    const folderId = await storageHierarchyService.resolveFolder({
      researchId: session.researchId,
      bucket: "SUBMISSIONS",
    });
    const stored = await googleDriveService.uploadFile({
      fileName: `panel-evaluation-${panelistId.slice(0, 8)}-${Date.now()}.pdf`,
      mimeType: "application/pdf",
      buffer: result.buffer,
      folderId,
      description: `Panel evaluation for ${session.research.title}`,
      appProperties: {
        advisioManaged: "true",
        advisioResearchId: session.researchId,
        advisioDefenseSessionId: sessionId,
        advisioPanelistId: panelistId,
        advisioLifecycle: "PANEL_EVALUATION",
      },
    });
    const document = await prisma.document.create({
      data: {
        researchId: session.researchId,
        documentType: "PANEL_EVALUATION",
        title: "Panelist Evaluation",
        createdBy: panelistId,
      },
    });
    return prisma.documentVersion.create({
      data: {
        documentId: document.id,
        versionNumber: 1,
        fileName: stored.fileName,
        mimeType: "application/pdf",
        fileSize: BigInt(stored.sizeBytes),
        storagePath: stored.webViewLink || stored.storagePath,
        googleDriveFileId: stored.fileId,
        uploadedBy: panelistId,
      },
    });
  }
}

export const defensePacketService = new DefensePacketService();
