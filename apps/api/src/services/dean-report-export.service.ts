import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFile } from "node:fs/promises";
import type {
  DeanReport,
  ReportTable,
} from "@research-management/shared/src/dean-monitoring";
import { monitoringError } from "./dean-monitoring-scope.js";

export function csvCell(value: unknown) {
  let text = String(value ?? "");
  if (/^[\s\uFEFF]*[=+\-@]/u.test(text) || /^[\t\r\n]/.test(text))
    text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}
export function reportCsv(report: DeanReport) {
  const rows: unknown[][] = [
    ["Report", report.title],
    ["College", report.scope.college.name],
    ["Generated at (UTC)", report.generatedAt],
    ["Timezone", report.timezone],
    ["Total data rows", report.total],
    ...Object.entries(report.filters),
    ...report.summary.map((s) => [s.label, s.value]),
    ...report.definitions.map((d) => ["Definition", d]),
    ...(report.breakdowns || []).flatMap((table) => [
      [],
      [table.title],
      table.columns.map((c) => c.label),
      ...table.rows.map((row) => table.columns.map((c) => row[c.key])),
    ]),
    [],
    report.columns.map((c) => c.label),
    ...report.rows.map((row) => report.columns.map((c) => row[c.key])),
  ];
  return "\uFEFF" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}
let fontBytes: Promise<Buffer> | undefined;
function reportFont() {
  return (fontBytes ??= readFile(
    new URL("../assets/fonts/LiberationSans-Regular.ttf", import.meta.url),
  ).catch(() =>
    readFile(
      new URL("../../assets/fonts/LiberationSans-Regular.ttf", import.meta.url),
    ),
  ));
}
export function wrapPdfText(
  text: string,
  font: PDFFont,
  size: number,
  width: number,
) {
  const lines: string[] = [];
  for (const paragraph of text
    .normalize("NFC")
    .replace(/\r/g, "")
    .split("\n")) {
    let line = "";
    for (const word of paragraph.trim().split(/\s+/u)) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= width) {
        line = candidate;
        continue;
      }
      if (line) {
        lines.push(line);
        line = "";
      }
      if (font.widthOfTextAtSize(word, size) <= width) {
        line = word;
        continue;
      }
      for (const char of word) {
        if (line && font.widthOfTextAtSize(line + char, size) > width) {
          lines.push(line);
          line = "";
        }
        line += char;
      }
    }
    lines.push(line);
  }
  return lines;
}
export async function reportPdf(report: DeanReport) {
  const deadline = Date.now() + 20000;
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(await reportFont(), { subset: true });
  pdf.setTitle(`${report.title} — ${report.scope.college.name}`);
  pdf.setAuthor("Advisio");
  const supported = new Set(font.getCharacterSet());
  const text = (value: unknown) => {
    const valueText = String(value ?? "—").normalize("NFC");
    for (const ch of valueText)
      if (
        !["\n", "\r", "\t"].includes(ch) &&
        !supported.has(ch.codePointAt(0)!)
      )
        throw monitoringError(
          "A character in this report is not supported by the PDF font. Use CSV to preserve the full text.",
          422,
        );
    return valueText;
  };
  let page!: PDFPage;
  let y = 0;
  const navy = rgb(0.04, 0.23, 0.33),
    gray = rgb(0.35, 0.4, 0.45);
  const newPage = () => {
    page = pdf.addPage([842, 595]);
    y = 548;
    page.drawText(report.title, { x: 32, y, size: 15, font, color: navy });
    y -= 21;
    for (const line of wrapPdfText(
      text(report.scope.college.name),
      font,
      10,
      778,
    )) {
      page.drawText(line, { x: 32, y, size: 10, font, color: gray });
      y -= 14;
    }
    y -= 10;
  };
  const paragraph = (value: string, size = 9) => {
    for (const line of wrapPdfText(text(value), font, size, 778)) {
      if (y < 45) newPage();
      page.drawText(line, { x: 32, y, size, font });
      y -= size + 4;
    }
    y -= 5;
  };
  newPage();
  paragraph(
    `Generated: ${report.generatedAt} | Timezone: ${report.timezone} | Data rows: ${report.total}`,
  );
  for (const [name, value] of Object.entries(report.filters))
    paragraph(`${name}: ${value}`);
  for (const s of report.summary) paragraph(`${s.label}: ${s.value}`);
  for (const d of report.definitions) paragraph(d, 8);
  function renderTable(table: ReportTable) {
    const weights: Record<string, number> = {
      title: 2.7,
      adviser: 1.5,
      id: 1.5,
      stage: 1.35,
      decision: 1.45,
      program: 0.75,
      releasedAt: 1.2,
    };
    const totalWeight = table.columns.reduce(
      (sum, c) => sum + (weights[c.key] ?? 1),
      0,
    );
    let nextX = 32;
    const columns = table.columns.map((c) => {
      const width = (778 * (weights[c.key] ?? 1)) / totalWeight;
      const x = nextX;
      nextX += width;
      return { ...c, width, x };
    });
    const size = 8,
      lineHeight = 11,
      bottom = 42;
    const layout = (value: unknown, width: number) =>
      wrapPdfText(text(value), font, size, width - 10);
    const draw = (
      cells: string[][],
      offset = 0,
      count = Number.MAX_SAFE_INTEGER,
      color = rgb(0, 0, 0),
    ) => {
      cells.forEach((lines, i) =>
        lines.slice(offset, offset + count).forEach((line, j) => {
          page.drawText(line, {
            x: columns[i].x + 5,
            y: y - j * lineHeight,
            size,
            font,
            color,
          });
        }),
      );
    };
    const labels = columns.map((c) => layout(c.label, c.width));
    const headerHeight =
      Math.max(...labels.map((l) => l.length)) * lineHeight + 10;
    const header = (forcePage = false) => {
      if (forcePage || y < bottom + headerHeight + 48) newPage();
      paragraph(table.title, 10);
      page.drawRectangle({
        x: 32,
        y: y - headerHeight + 10,
        width: 778,
        height: headerHeight,
        color: rgb(0.92, 0.95, 0.96),
      });
      draw(labels, 0, undefined, navy);
      y -= headerHeight + 2;
    };
    header();
    if (!table.rows.length) paragraph("No records match these filters.");
    for (const row of table.rows) {
      if (Date.now() > deadline)
        throw monitoringError(
          "Report generation took too long. Narrow the filters and try again.",
          422,
        );
      const cells = columns.map((c) => layout(row[c.key], c.width));
      const count = Math.max(...cells.map((c) => c.length));
      // Keep normal rows together; paginate exceptionally tall rows without clipping.
      if (y - count * lineHeight < bottom && count * lineHeight < 380)
        header(true);
      for (let offset = 0; offset < count; ) {
        if (y < bottom + lineHeight) header(true);
        const take = Math.min(
          count - offset,
          Math.floor((y - bottom) / lineHeight),
        );
        draw(cells, offset, take);
        y -= take * lineHeight + 8;
        page.drawLine({
          start: { x: 32, y: y + 9 },
          end: { x: 810, y: y + 9 },
          color: rgb(0.86, 0.89, 0.91),
          thickness: 0.5,
        });
        offset += take;
      }
    }
    y -= 14;
  }
  for (const table of report.breakdowns || [])
    if (table.rows.length) renderTable(table);
  renderTable({
    title: "Detail records",
    columns: report.columns,
    rows: report.rows,
  });
  const pages = pdf.getPages();
  pages.forEach((p, i) =>
    p.drawText(`Advisio | ${i + 1} / ${pages.length}`, {
      x: 32,
      y: 20,
      size: 8,
      font,
      color: gray,
    }),
  );
  return Buffer.from(await pdf.save());
}
