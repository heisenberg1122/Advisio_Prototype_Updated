import { createHash } from "node:crypto";
import {
  PDFDocument,
  StandardFonts,
  rgb,
  pushGraphicsState,
  popGraphicsState,
  concatTransformationMatrix,
} from "pdf-lib";
import { z } from "zod";

export class PdfAnnotationError extends Error {}

export const boxSchema = z
  .object({
    page: z.number().int().min(1).max(500),
    x: z.number().finite().min(0).max(1),
    y: z.number().finite().min(0).max(1),
    width: z.number().finite().min(0.005).max(1),
    height: z.number().finite().min(0.005).max(1),
  })
  .refine(
    (v) => v.x + v.width <= 1.00001 && v.y + v.height <= 1.00001,
    "Keep marks inside the page.",
  );
export const annotationsSchema = z
  .array(
    z
      .object({
        id: z.string().uuid(),
        type: z.enum([
          "check",
          "cross",
          "circle",
          "text",
          "highlight",
          "comment",
        ]),
        page: z.number().int().min(1).max(500),
        x: z.number().finite().min(0).max(1),
        y: z.number().finite().min(0).max(1),
        width: z.number().finite().min(0.005).max(1),
        height: z.number().finite().min(0.005).max(1),
        text: z.string().max(4000).optional(),
      })
      .superRefine((v, ctx) => {
        if (v.x + v.width > 1.00001 || v.y + v.height > 1.00001)
          ctx.addIssue({
            code: "custom",
            message: "Keep marks inside the page.",
          });
        if (["text", "comment"].includes(v.type) && !v.text?.trim())
          ctx.addIssue({
            code: "custom",
            message: "Text and comments cannot be empty.",
          });
      }),
  )
  .max(500);
export type PdfMark = z.infer<typeof annotationsSchema>[number];
export type PdfBox = z.infer<typeof boxSchema>;
export const pdfHash = (value: Uint8Array | string) =>
  createHash("sha256").update(value).digest("hex");

export function evaluationRevisionHash(item: {
  sourceChecksum: string;
  annotations: unknown;
  revision: number;
  signatureData?: Uint8Array | null;
  signaturePlacement?: unknown;
}) {
  return pdfHash(
    JSON.stringify({
      source: item.sourceChecksum,
      marks: item.annotations,
      revision: item.revision,
      signature: item.signatureData ? pdfHash(item.signatureData) : null,
      placement: item.signaturePlacement || null,
    }),
  );
}

export async function renderAnnotatedPdf(
  source: Uint8Array,
  marks: PdfMark[],
  signature?: { data: Uint8Array; placement: PdfBox } | null,
) {
  const pdf = await PDFDocument.load(source);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (const mark of marks) {
    if (mark.text) {
      try {
        font.encodeText(mark.text.replace(/[\r\n]/g, " "));
      } catch {
        throw new PdfAnnotationError(
          "This PDF font cannot display one of the characters in your text. Use supported Latin characters for this version.",
        );
      }
    }
  }
  const originalPages = pdf.getPages();
  const ink = rgb(0.08, 0.22, 0.4);
  const comments: { page: number; text: string; number: number }[] = [];
  for (const mark of [
    ...marks,
    ...(signature ? [{ ...signature.placement, type: "signature" }] : []),
  ]) {
    if (!originalPages[mark.page - 1])
      throw new PdfAnnotationError(
        "An annotation points to a missing PDF page.",
      );
  }
  for (let index = 0; index < originalPages.length; index++) {
    const page = originalPages[index];
    const crop = page.getCropBox();
    const rotation = ((page.getRotation().angle % 360) + 360) % 360;
    const width = rotation % 180 ? crop.height : crop.width;
    const height = rotation % 180 ? crop.width : crop.height;
    const matrix: [number, number, number, number, number, number] =
      rotation === 90
        ? [0, 1, -1, 0, crop.x + crop.width, crop.y]
        : rotation === 180
          ? [-1, 0, 0, -1, crop.x + crop.width, crop.y + crop.height]
          : rotation === 270
            ? [0, -1, 1, 0, crop.x, crop.y + crop.height]
            : [1, 0, 0, 1, crop.x, crop.y];
    page.pushOperators(
      pushGraphicsState(),
      concatTransformationMatrix(...matrix),
    );
    for (const mark of marks.filter((m) => m.page === index + 1)) {
      const x = mark.x * width,
        y = (1 - mark.y - mark.height) * height;
      const w = mark.width * width,
        h = mark.height * height;
      if (mark.type === "circle")
        page.drawEllipse({
          x: x + w / 2,
          y: y + h / 2,
          xScale: w / 2,
          yScale: h / 2,
          borderColor: ink,
          borderWidth: 1.4,
        });
      if (mark.type === "highlight")
        page.drawRectangle({
          x,
          y,
          width: w,
          height: h,
          color: rgb(1, 0.85, 0.1),
          opacity: 0.3,
        });
      if (mark.type === "cross") {
        page.drawLine({
          start: { x, y },
          end: { x: x + w, y: y + h },
          color: ink,
          thickness: 1.6,
        });
        page.drawLine({
          start: { x: x + w, y },
          end: { x, y: y + h },
          color: ink,
          thickness: 1.6,
        });
      }
      if (mark.type === "check") {
        page.drawLine({
          start: { x, y: y + h * 0.5 },
          end: { x: x + w * 0.35, y },
          color: ink,
          thickness: 1.6,
        });
        page.drawLine({
          start: { x: x + w * 0.35, y },
          end: { x: x + w, y: y + h },
          color: ink,
          thickness: 1.6,
        });
      }
      if (mark.type === "text") {
        const size = 10;
        const lines = (mark.text || "").split("\n");
        if (
          lines.length * 12 > h ||
          lines.some((line) => font.widthOfTextAtSize(line, size) > w)
        )
          throw new PdfAnnotationError(
            "A text box is too small. Resize it or use a comment for longer feedback.",
          );
        lines.forEach((line, i) =>
          page.drawText(line, {
            x,
            y: y + h - 10 - i * 12,
            size,
            font,
            color: ink,
          }),
        );
      }
      if (mark.type === "comment") {
        const number = comments.length + 1;
        comments.push({ page: index + 1, text: mark.text || "", number });
        page.drawRectangle({
          x,
          y,
          width: w,
          height: h,
          color: rgb(1, 0.94, 0.65),
          borderColor: ink,
          borderWidth: 0.5,
        });
        page.drawText(String(number), {
          x: x + 2,
          y: y + Math.max(1, h / 2 - 4),
          size: Math.min(10, h - 2),
          font,
          color: ink,
        });
      }
    }
    if (signature?.placement.page === index + 1) {
      const image = await pdf.embedPng(signature.data);
      const b = signature.placement;
      const availableW = b.width * width,
        availableH = b.height * height;
      const scale = Math.min(
        availableW / image.width,
        availableH / image.height,
      );
      page.drawImage(image, {
        x: b.x * width + (availableW - image.width * scale) / 2,
        y:
          (1 - b.y - b.height) * height +
          (availableH - image.height * scale) / 2,
        width: image.width * scale,
        height: image.height * scale,
      });
    }
    page.pushOperators(popGraphicsState());
  }
  if (comments.length) {
    let page = pdf.addPage([612, 792]);
    let y = 750;
    page.drawText("Panelist comments", {
      x: 40,
      y,
      size: 16,
      font,
      color: ink,
    });
    y -= 30;
    for (const comment of comments) {
      const words =
        `Comment ${comment.number} - source page ${comment.page}: ${comment.text}`.split(
          /\s+/,
        );
      let line = "";
      const lines: string[] = [];
      for (const word of words) {
        if (font.widthOfTextAtSize(word, 10) > 532) {
          // Split long URLs/words instead of truncating feedback.
          if (line) {
            lines.push(line);
            line = "";
          }
          let piece = "";
          for (const character of word) {
            if (font.widthOfTextAtSize(piece + character, 10) > 532) {
              lines.push(piece);
              piece = "";
            }
            piece += character;
          }
          line = piece;
        } else if (font.widthOfTextAtSize(`${line} ${word}`, 10) > 532) {
          lines.push(line);
          line = word;
        } else line += (line ? " " : "") + word;
      }
      if (line) lines.push(line);
      for (const text of lines) {
        if (y < 45) {
          page = pdf.addPage([612, 792]);
          y = 750;
        }
        page.drawText(text, { x: 40, y, size: 10, font, color: ink });
        y -= 14;
      }
      y -= 12;
    }
  }
  return Buffer.from(await pdf.save());
}
