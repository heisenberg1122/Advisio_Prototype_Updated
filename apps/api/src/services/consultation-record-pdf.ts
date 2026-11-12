import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { reportFont, wrapPdfText } from "./dean-report-export.service.js";
import type { ConsultationRecordView } from "./consultation-record.service.js";

const dateTime = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila",
});
const width = 595.28;
const height = 841.89;
const margin = 48;
const navy = rgb(0.05, 0.21, 0.32);
const slate = rgb(0.28, 0.34, 0.41);

type ConfirmedProof = Extract<NonNullable<ConsultationRecordView["proof"]>, { status: "confirmed" }>;

export async function renderConsultationRecordPdf(
  record: Pick<ConsultationRecordView, "title" | "project" | "scheduledStart" | "scheduledEnd">,
  proof: ConfirmedProof,
  details?: Pick<NonNullable<ConsultationRecordView["details"]>, "summary" | "nextSteps">,
) {
  const document = await PDFDocument.create();
  document.registerFontkit(fontkit);
  const body = await document.embedFont(await reportFont(), { subset: true });
  const heading = await document.embedFont(StandardFonts.HelveticaBold);
  const title = details ? "Consultation Record" : "Proof of Consultation";
  document.setTitle(title);
  document.setAuthor("Advisio");

  const supported = new Set(body.getCharacterSet());
  const printable = (text: string) => Array.from(text.normalize("NFC"), (character) =>
    /\s/u.test(character) || supported.has(character.codePointAt(0)!) ? character : "?",
  ).join("");

  function addPage() {
    const page = document.addPage([width, height]);
    page.drawRectangle({ x: 0, y: height - 10, width, height: 10, color: navy });
    page.drawText("ADVISIO", { x: margin, y: height - 54, font: heading, size: 10, color: slate });
    page.drawText(title, { x: margin, y: height - 88, font: heading, size: 25, color: navy });
    page.drawText(proof.reference, { x: margin, y: 37, font: body, size: 9, color: slate });
    page.drawText(String(document.getPageCount()), { x: width - margin, y: 37, font: body, size: 9, color: slate });
    return page;
  }

  let page = addPage();
  let y = height - 124;
  function field(label: string, value: string) {
    const lines = wrapPdfText(printable(value), body, 11, width - 2 * margin);
    if (y < 100) {
      page = addPage();
      y = height - 124;
    }
    page.drawText(label, { x: margin, y, font: heading, size: 10, color: slate });
    y -= 17;
    for (const line of lines) {
      if (y < 63) {
        page = addPage();
        y = height - 124;
      }
      page.drawText(line, { x: margin, y, font: body, size: 11, color: navy });
      y -= 15;
    }
    y -= 12;
  }

  const range = (start: Date, end: Date) => `${dateTime.format(start)} - ${dateTime.format(end)}`;
  field("Project", record.project);
  field("Consultation", record.title);
  field("Scheduled time (Philippine time)", range(record.scheduledStart, record.scheduledEnd));
  field("Participant-confirmed time (Philippine time)", range(proof.actualStart, proof.actualEnd));
  field("Duration", `${proof.durationMinutes} ${proof.durationMinutes === 1 ? "minute" : "minutes"}`);
  field("Submitted by", `${proof.submittedBy} on ${dateTime.format(proof.submittedAt)}`);
  field("Confirmed by", `${proof.confirmedBy} on ${dateTime.format(proof.confirmedAt)}`);
  if (details) {
    field("Summary", details.summary);
    field("Agreed next steps", details.nextSteps || "None recorded");
  }
  return Buffer.from(await document.save());
}
