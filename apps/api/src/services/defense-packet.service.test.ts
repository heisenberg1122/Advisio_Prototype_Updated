import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import {
  composeMappedPdf,
  type PdfFieldMapping,
} from "./defense-packet.service.js";

async function template() {
  const pdf = await PDFDocument.create();
  pdf.addPage([612, 792]);
  return Buffer.from(await pdf.save());
}

const mapping = (
  overrides: Partial<PdfFieldMapping> = {},
): PdfFieldMapping => ({
  key: "remarks",
  label: "Panel Remarks",
  pageNumber: 1,
  x: 0.1,
  y: 0.1,
  width: 0.3,
  height: 0.04,
  preferredFontSize: 10,
  minimumFontSize: 8,
  lineHeight: 1.2,
  alignment: "LEFT",
  multiline: true,
  overflowPolicy: "APPENDIX",
  required: true,
  ...overrides,
});

describe("defense packet PDF layout", () => {
  it("preserves long narrative content on an appendix page", async () => {
    const result = await composeMappedPdf(await template(), [mapping()], {
      remarks: "A detailed required revision. ".repeat(100),
    });
    const rendered = await PDFDocument.load(result.buffer);
    expect(rendered.getPageCount()).toBeGreaterThan(1);
    expect(result.report.appendedPages).toBe(1);
    expect(result.report.fields[0].status).toBe("MOVED_TO_APPENDIX");
  });

  it("rejects overflow when the field policy forbids continuation", async () => {
    await expect(
      composeMappedPdf(
        await template(),
        [mapping({ overflowPolicy: "REJECT" })],
        {
          remarks: "This text cannot fit. ".repeat(50),
        },
      ),
    ).rejects.toThrow(/does not fit/i);
  });

  it("rejects a missing required value", async () => {
    await expect(
      composeMappedPdf(await template(), [mapping()], {}),
    ).rejects.toThrow(/required/i);
  });
});
