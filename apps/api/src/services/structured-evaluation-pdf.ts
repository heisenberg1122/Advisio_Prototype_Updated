import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import {
  defaultEvaluationBranding,
  defenseResultLabels,
  type StructuredAnswers,
  type StructuredForm,
} from "@research-management/validations";
import type { FormSnapshot } from "./structured-evaluation.service.js";

const printable = (s: string) =>
  s
    .replace(/[–—]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\x20-\x7e\xa0-\xff\n]/g, "?");
const ink = rgb(0, 0, 0),
  navy = rgb(0, 0.15, 0.33),
  gray = rgb(0.4, 0.4, 0.4);

// Reject oversized/invalid images before decoding; never fetch a supplied URL.
export async function validateEvaluationLogos(spec: StructuredForm) {
  const pdf = await PDFDocument.create();
  for (const value of [spec.branding?.schoolLogo, spec.branding?.collegeLogo]) {
    if (!value) continue;
    const bytes = Buffer.from(value.split(",")[1] || "", "base64");
    if (
      bytes.length < 24 ||
      bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a" ||
      bytes.toString("ascii", 12, 16) !== "IHDR" ||
      bytes.readUInt32BE(16) < 1 ||
      bytes.readUInt32BE(20) < 1 ||
      bytes.readUInt32BE(16) > 1024 ||
      bytes.readUInt32BE(20) > 1024
    ) {
      throw Object.assign(
        new Error("Use a valid PNG logo no larger than 1024 x 1024 pixels."),
        { statusCode: 400 },
      );
    }
    try {
      await pdf.embedPng(bytes);
    } catch {
      throw Object.assign(
        new Error("The logo could not be read. Choose another PNG image."),
        { statusCode: 400 },
      );
    }
  }
}

export async function renderEvaluationPdf(
  snapshot: FormSnapshot,
  answers: StructuredAnswers,
  panelistName: string,
  totals: {
    researchers: { userId: string; score: number; maximum: number }[];
    manuscript: { score: number; maximum: number };
  },
) {
  await validateEvaluationLogos(snapshot.spec);
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.TimesRoman),
    bold = await pdf.embedFont(StandardFonts.TimesRomanBold),
    sans = await pdf.embedFont(StandardFonts.Helvetica),
    sansBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  // Old snapshots remain readable without silently acquiring the IT college identity.
  const branding = snapshot.spec.branding || {
    ...defaultEvaluationBranding,
    collegeName: "",
    collegeLogo: "",
    templateName: "",
  };
  const logos = await Promise.all(
    [branding.schoolLogo, branding.collegeLogo].map((value) =>
      value ? pdf.embedPng(value) : null,
    ),
  );
  const W = 612,
    H = 792,
    left = 42,
    width = 528,
    bottom = 54;
  let page = pdf.addPage([W, H]),
    y = 0;
  const wrap = (
    value: string,
    f: PDFFont,
    size: number,
    max: number,
  ): string[] => {
    const result: string[] = [];
    for (const paragraph of printable(value).split("\n")) {
      let current = "";
      for (const word of paragraph.split(/\s+/)) {
        if (current && f.widthOfTextAtSize(current + " " + word, size) > max) {
          result.push(current);
          current = "";
        }
        // Break unbroken names/comments so they cannot escape the cell.
        for (const char of (current ? " " : "") + word) {
          if (f.widthOfTextAtSize(current + char, size) > max && current) {
            result.push(current);
            current = "";
          }
          current += char;
        }
      }
      result.push(current);
    }
    return result;
  };
  const text = (
    value: string,
    x: number,
    top: number,
    f = font,
    size = 9,
    color = ink,
  ) =>
    page.drawText(printable(value), { x, y: top - size, font: f, size, color });
  const centered = (
    value: string,
    x: number,
    top: number,
    max: number,
    f: PDFFont,
    size: number,
    color = ink,
  ) => {
    const s = Math.min(
      size,
      max / Math.max(1, f.widthOfTextAtSize(printable(value), 1)),
    );
    text(
      value,
      x + (max - f.widthOfTextAtSize(printable(value), s)) / 2,
      top,
      f,
      s,
      color,
    );
  };
  const header = (section: string, fresh = true) => {
    if (!fresh) page = pdf.addPage([W, H]);
    // Both seals use identical square bounds and symmetric margins.
    logos.forEach((logo, i) => {
      if (!logo) return;
      const scale = 62 / Math.max(logo.width, logo.height),
        w = logo.width * scale,
        h = logo.height * scale;
      page.drawImage(logo, {
        x: (i ? W - 94 : 32) + (62 - w) / 2,
        y: H - 86 + (62 - h) / 2,
        width: w,
        height: h,
      });
    });
    centered(branding.schoolName, 100, H - 29, 412, bold, 21, navy);
    const address = wrap(branding.schoolAddress, font, 8, 412);
    address
      .slice(0, 2)
      .forEach((line, i) =>
        centered(line, 100, H - 54 - i * 9, 412, font, 8, navy),
      );
    centered(branding.collegeName, 100, H - 74, 412, bold, 13, navy);
    page.drawLine({
      start: { x: 96, y: H - 91 },
      end: { x: W - 96, y: H - 91 },
      thickness: 0.6,
      color: gray,
    });
    const template = wrap(branding.templateName, sans, 8, width);
    let titleY = H - 100;
    for (const line of template) {
      text(line, W - left - sans.widthOfTextAtSize(line, 8), titleY, sans, 8);
      titleY -= 10;
    }
    y = titleY - 12;
    for (const line of wrap(
      snapshot.spec.name.toUpperCase(),
      sansBold,
      13,
      width,
    )) {
      centered(line, left, y, width, sansBold, 13);
      y -= 17;
    }
    y -= 11;
    text(section, left, y, sansBold, 10);
    y -= 20;
    for (const line of wrap(
      `Project: ${snapshot.researchTitle}`,
      sans,
      8,
      width,
    )) {
      text(line, left, y, sans, 8);
      y -= 11;
    }
    y -= 12;
  };
  const scale = [...snapshot.spec.scale].reverse(),
    ratingWidth = Math.min(36, 240 / scale.length),
    criteriaWidth = width - scale.length * ratingWidth - 94;
  const cell = (
    value: string,
    x: number,
    w: number,
    top: number,
    h: number,
    strong = false,
    align = false,
    fill = false,
    size = 9,
  ) => {
    page.drawRectangle({
      x,
      y: top - h,
      width: w,
      height: h,
      borderWidth: 0.5,
      borderColor: ink,
      ...(fill ? { color: rgb(0.94, 0.96, 0.98) } : {}),
    });
    const f = strong ? bold : font,
      lines = wrap(value, f, size, w - 12);
    lines.forEach((line, i) => {
      const ty = top - (h - lines.length * (size + 2)) / 2 - i * (size + 2);
      if (align) centered(line, x + 4, ty, w - 8, f, size);
      else text(line, x + 7, ty, f, size);
    });
  };
  const tableHeader = () => {
    const h = Math.max(
      28,
      ...scale.map(
        (s) => wrap(s.label, bold, 8, ratingWidth - 8).length * 10 + 8,
      ),
    );
    cell("Criteria", left, criteriaWidth, y, h + 22, true, false, true);
    cell(
      "Numerical & Verbal Rating (R)",
      left + criteriaWidth,
      scale.length * ratingWidth,
      y,
      22,
      true,
      true,
      true,
      8,
    );
    let x = left + criteriaWidth;
    for (const s of scale) {
      cell(s.label, x, ratingWidth, y - 22, h, true, true, true, 8);
      x += ratingWidth;
    }
    cell("Weight\n(W)", x, 40, y, h + 22, true, true, true, 8);
    cell("Score\n(R x W)", x + 40, 54, y, h + 22, true, true, true, 8);
    y -= h + 22;
  };
  const labelRow = (label: string) => {
    const h = Math.max(25, wrap(label, bold, 9, width - 14).length * 11 + 10);
    cell(label, left, width, y, h, true, false, true);
    y -= h;
  };
  const section = (
    title: string,
    criteria: StructuredForm["presentation"],
    ratings: Record<string, number>,
    total: { score: number; maximum: number },
    student?: string,
  ) => {
    const label = student ? `Student Name: ${student}` : "";
    const labelHeight = label
      ? Math.max(25, wrap(label, bold, 9, width - 14).length * 11 + 10)
      : 0;
    if (y - labelHeight - 85 < bottom) {
      header(title, false);
      tableHeader();
    }
    if (label) labelRow(label);
    for (const criterion of criteria) {
      const h = Math.max(
        26,
        wrap(criterion.title, font, 9, criteriaWidth - 14).length * 11 + 12,
      );
      if (y - h - 24 < bottom) {
        header(`${title} (continued)`, false);
        tableHeader();
        if (label) labelRow(label);
      }
      cell(criterion.title, left, criteriaWidth, y, h);
      let x = left + criteriaWidth;
      for (const s of scale) {
        cell(
          String(s.value),
          x,
          ratingWidth,
          y,
          h,
          ratings[criterion.id] === s.value,
          true,
        );
        if (ratings[criterion.id] === s.value)
          page.drawCircle({
            x: x + ratingWidth / 2,
            y: y - h / 2,
            size: 8,
            borderWidth: 0.8,
            borderColor: navy,
          });
        x += ratingWidth;
      }
      cell(String(criterion.weight), x, 40, y, h, false, true);
      cell(
        String(Number((ratings[criterion.id] * criterion.weight).toFixed(2))),
        x + 40,
        54,
        y,
        h,
        false,
        true,
      );
      y -= h;
    }
    cell(
      student ? "Presentation Total" : "Manuscript Total",
      left,
      width - 74,
      y,
      24,
      true,
      false,
      true,
    );
    cell(
      `${Number(total.score.toFixed(2))} / ${Number(total.maximum.toFixed(2))}`,
      W - left - 74,
      74,
      y,
      24,
      true,
      true,
      true,
    );
    y -= 24;
  };
  header("Individual Presentation");
  tableHeader();
  for (const r of snapshot.roster)
    section(
      "Individual Presentation",
      snapshot.spec.presentation,
      answers.researchers[r.userId],
      totals.researchers.find((t) => t.userId === r.userId)!,
      r.name,
    );
  header("Group Manuscript", false);
  tableHeader();
  section(
    "Group Manuscript",
    snapshot.spec.manuscript,
    answers.manuscript,
    totals.manuscript,
  );
  const ensure = (space: number) => {
    if (y - space < bottom)
      header("Panel Recommendation / Required Revisions (continued)", false);
  };
  y -= 22;
  const headingLines = wrap(snapshot.spec.feedbackLabel, sansBold, 10, width);
  ensure(headingLines.length * 13 + 45);
  for (const line of headingLines) {
    text(line, left, y, sansBold, 10);
    y -= 13;
  }
  y -= 8;
  const feedback = wrap(
    answers.feedback || "No additional feedback.",
    font,
    10,
    width - 20,
  );
  while (feedback.length) {
    ensure(30);
    const count = Math.max(1, Math.floor((y - bottom - 16) / 14)),
      lines = feedback.splice(0, count),
      h = lines.length * 14 + 16;
    page.drawRectangle({
      x: left,
      y: y - h,
      width,
      height: h,
      borderWidth: 0.5,
      borderColor: gray,
    });
    lines.forEach((line, i) => text(line, left + 10, y - 8 - i * 14, font, 10));
    y -= h + 14;
  }
  const result = wrap(
    `Recommended defense result: ${defenseResultLabels[answers.recommendation as keyof typeof defenseResultLabels]}`,
    sansBold,
    9,
    width,
  );
  const signatureLines = wrap(answers.signature || panelistName, bold, 11, 235);
  ensure(result.length * 12 + signatureLines.length * 13 + 90);
  for (const line of result) {
    text(line, left, y, sansBold, 9);
    y -= 12;
  }
  y -= 30;
  for (const line of signatureLines) {
    centered(line, 323, y, 235, bold, 11);
    y -= 13;
  }
  page.drawLine({
    start: { x: 323, y: y - 3 },
    end: { x: 558, y: y - 3 },
    thickness: 0.6,
    color: ink,
  });
  centered("CAPSTONE PANEL - Panelist", 323, y - 10, 235, font, 9);
  if (answers.signature)
    centered("Typed electronic signature", 323, y - 24, 235, sans, 7, gray);
  for (const [i, p] of pdf.getPages().entries()) {
    p.drawText(
      "Official defense result is released separately by the facilitator.",
      { x: left, y: 32, size: 7, font: sans, color: gray },
    );
    const footer = `Advisio | Page ${i + 1} of ${pdf.getPageCount()}`;
    p.drawText(footer, {
      x: W - left - sans.widthOfTextAtSize(footer, 7),
      y: 20,
      size: 7,
      font: sans,
      color: gray,
    });
  }
  return Buffer.from(await pdf.save());
}
