import { describe, expect, it } from "vitest";
import { PDFDocument, degrees } from "pdf-lib";
import {
  annotationsSchema,
  boxSchema,
  evaluationRevisionHash,
  renderAnnotatedPdf,
  type PdfMark,
} from "./pdf-annotation.service.js";

const mark = (changes: Partial<PdfMark> = {}): PdfMark => ({
  id: "9372fd0b-c454-4a51-819f-531d6610173e",
  type: "circle",
  page: 1,
  x: 0.1,
  y: 0.2,
  width: 0.04,
  height: 0.025,
  ...changes,
});
async function source() {
  const doc = await PDFDocument.create();
  doc.addPage([612, 792]);
  return doc.save();
}
describe("PDF evaluation annotations", () => {
  it("rejects out-of-page and malformed marks instead of silently clipping", () => {
    expect(annotationsSchema.safeParse([mark({ x: 0.99 })]).success).toBe(
      false,
    );
    expect(annotationsSchema.safeParse([mark({ page: 0 })]).success).toBe(
      false,
    );
    expect(
      annotationsSchema.safeParse([mark({ type: "comment", text: " " })])
        .success,
    ).toBe(false);
    expect(
      boxSchema.safeParse({ page: 1, x: 0.9, y: 0, width: 0.2, height: 0.1 })
        .success,
    ).toBe(false);
  });
  it("retains source pages and adds readable comment continuation pages", async () => {
    const bytes = await renderAnnotatedPdf(await source(), [
      mark(),
      mark({ type: "comment", text: "Feedback ".repeat(350) }),
    ]);
    const result = await PDFDocument.load(bytes);
    expect(result.getPageCount()).toBeGreaterThan(1);
    expect(result.getPage(0).getWidth()).toBe(612);
    expect(result.getPage(0).getHeight()).toBe(792);
  });
  it("rejects missing pages and text that will not fit", async () => {
    await expect(
      renderAnnotatedPdf(await source(), [mark({ page: 2 })]),
    ).rejects.toThrow("missing PDF page");
    await expect(
      renderAnnotatedPdf(await source(), [
        mark({
          type: "text",
          text: "This text cannot fit into that small box",
        }),
      ]),
    ).rejects.toThrow("too small");
  });
  it("supports marks on cropped rotated pages without changing the original page geometry", async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([800, 600]);
    page.setCropBox(20, 30, 700, 500);
    page.setRotation(degrees(90));
    const out = await PDFDocument.load(
      await renderAnnotatedPdf(await doc.save(), [mark({ type: "check" })]),
    );
    expect(out.getPage(0).getRotation().angle).toBe(90);
    expect(out.getPage(0).getCropBox()).toEqual({
      x: 20,
      y: 30,
      width: 700,
      height: 500,
    });
  });
  it("invalidates preview hashes after annotation, revision, or signature changes", () => {
    const draft = {
      sourceChecksum: "source",
      annotations: [mark()],
      revision: 1,
    };
    const hash = evaluationRevisionHash(draft);
    expect(
      evaluationRevisionHash({ ...draft, annotations: [mark({ x: 0.3 })] }),
    ).not.toBe(hash);
    expect(evaluationRevisionHash({ ...draft, revision: 2 })).not.toBe(hash);
    expect(
      evaluationRevisionHash({
        ...draft,
        signatureData: new Uint8Array([1, 2, 3]),
      }),
    ).not.toBe(hash);
  });
});
