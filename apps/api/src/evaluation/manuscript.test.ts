import { describe, it, expect } from "vitest";
import { PDFDocument } from "pdf-lib";
import { EVALUATION_COURSES } from "./catalog.js";
import { manuscript } from "./manuscript.js";

describe("readable fictional research documents", () => {
  it("renders every discipline and all three revisions without overflowing", async () => {
    for (const course of EVALUATION_COURSES)
      for (const version of [1, 2, 3]) {
        const buffer = await manuscript(course, version);
        const pdf = await PDFDocument.load(buffer);
        expect(pdf.getPageCount()).toBe(5);
        expect(pdf.getTitle()).toContain("Fictional evaluation sample");
        expect(buffer.subarray(0, 4).toString()).toBe("%PDF");
      }
  }, 15000);
});
