import type { DefenseCertificate } from "@research-management/database";
import { readFile } from "node:fs/promises";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import QRCode from "qrcode";
import { wrapPdfText } from "./dean-report-export.service.js";

const width = 841.89;
const height = 595.28;
const navy = rgb(0.043, 0.227, 0.325);
const slate = rgb(0.345, 0.392, 0.478);
const gold = rgb(0.788, 0.635, 0.153);
const dateFormat = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "long",
  timeZone: "Asia/Manila",
});

const collegeSeals: Record<string, string> = {
  COA: "coa", CEA: "cea", CHTM: "chtm", CIT: "cit", CITCLS: "cit",
  CCS: "cit", CICT: "cit", CNP: "cnp", CONP: "cnp", SAS: "sas", SBPA: "sbpa", SOE: "soe",
};

const waveLayers = [
  { color: rgb(0.925, 0.957, 0.98), depth: 1 },
  { color: rgb(0.839, 0.902, 0.953), depth: 0.62 },
  { color: rgb(0.663, 0.776, 0.867), depth: 0.25 },
];

const assets = new Map<string, Promise<Buffer>>();
function asset(name: string) {
  let bytes = assets.get(name);
  if (!bytes) {
    const development = name.endsWith(".ttf")
      ? new URL(`../../assets/fonts/${name}`, import.meta.url)
      : new URL(`../../../web/public/${name}`, import.meta.url);
    bytes = readFile(new URL(`./certificate-assets/${name}`, import.meta.url))
      .catch((error) => {
        if (error.code !== "ENOENT") throw error;
        return readFile(development);
      });
    assets.set(name, bytes);
  }
  return bytes;
}

type CertificateData = Pick<DefenseCertificate,
  "recipientName" | "coordinator" | "dean" | "collegeName" | "collegeCode" |
  "researchTitle" | "awardedAt"
>;

export async function renderDefenseCertificate(certificate: CertificateData, verificationUrl: string) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  pdf.setTitle("Final Defense Certificate");
  pdf.setAuthor("University of the Assumption");
  const page = pdf.addPage([width, height]);
  const seal = collegeSeals[certificate.collegeCode.toUpperCase()];
  const [body, heading, nameFont, ua, department, advisio, qr] = await Promise.all([
    asset("LiberationSans-Regular.ttf").then((bytes) => pdf.embedFont(bytes, { subset: true })),
    pdf.embedFont(StandardFonts.HelveticaBold),
    pdf.embedFont(StandardFonts.TimesRoman),
    asset("school-logo.png").then((bytes) => pdf.embedPng(bytes)),
    seal ? asset(`college-logos/${seal}.png`).then((bytes) => pdf.embedPng(bytes)) : null,
    asset("advisio-logo.png").then((bytes) => pdf.embedPng(bytes)),
    QRCode.toBuffer(verificationUrl, { errorCorrectionLevel: "M", margin: 4, scale: 8 })
      .then((bytes) => pdf.embedPng(bytes)),
  ]);

  for (const { color, depth } of waveLayers) {
    const top = `M0 0 L0 ${61 * depth} C134 ${61 * depth} 194 ${14 * depth} 343 ${14 * depth} C518 ${14 * depth} 570 ${44 * depth} 694 ${44 * depth} C754 ${44 * depth} 806 ${33 * depth} ${width} ${27 * depth} L${width} 0 Z`;
    const bottom = `M0 0 L0 ${-25 * depth} C85 ${-12 * depth} 164 ${-12 * depth} 239 ${-25 * depth} C356 ${-45 * depth} 416 ${-45 * depth} 519 ${-34 * depth} C644 ${-16 * depth} 742 ${-34 * depth} ${width} ${-61 * depth} L${width} 0 Z`;
    page.drawSvgPath(top, { x: 0, y: height, color });
    page.drawSvgPath(bottom, { x: 0, y: 0, color });
  }

  function text(value: string, y: number, size: number, options: {
    font?: PDFFont; color?: typeof navy; center?: number; maxWidth?: number;
  } = {}) {
    const { font = body, color = navy, center = width / 2, maxWidth = width - 152 } = options;
    const clean = value.normalize("NFC").replace(/\s+/gu, " ").trim();
    if (!clean) return;
    const textWidth = font.widthOfTextAtSize(clean, size);
    const fit = Math.min(size, (size * maxWidth) / textWidth);
    page.drawText(clean, { x: center - font.widthOfTextAtSize(clean, fit) / 2, y, size: fit, font, color });
  }

  function logo(image: PDFImage, x: number, y: number, size: number, opacity = 1) {
    const dimensions = image.scaleToFit(size, size);
    page.drawImage(image, { ...dimensions, x: x - dimensions.width / 2, y: y - dimensions.height / 2, opacity });
  }

  logo(ua, 149, 505, 70);
  if (department) logo(department, width - 149, 505, 70);
  text("University of the Assumption", 513, 20, { font: heading, maxWidth: 425 });
  text(certificate.collegeName.toUpperCase(), 490, 12, { color: slate, maxWidth: 430 });

  text("CERTIFICATE", 410, 41, { font: heading });
  text("OF COMPLETION", 383, 16, { font: heading });
  text("FINAL DEFENSE", 358, 13, { font: heading, color: slate });
  text("This is to certify that", 320, 14);
  // Prefer serif for the name, using the embedded font for characters outside WinAnsi.
  const serifCharacters = new Set(nameFont.getCharacterSet());
  const recipientFont = [...certificate.recipientName.normalize("NFC")].every(
    (char) => serifCharacters.has(char.codePointAt(0)!),
  ) ? nameFont : body;
  text(certificate.recipientName, 269, 49, { font: recipientFont, maxWidth: 690 });
  page.drawLine({ start: { x: 218, y: 253 }, end: { x: width - 218, y: 253 }, thickness: 1, color: gold });
  text(`of the ${certificate.collegeName} has completed the Final Defense`, 226, 14);
  text("for the research study", 205, 14);

  const title = certificate.researchTitle.replace(/\s+/gu, " ").trim();
  let titleSize = 16;
  let titleLines = wrapPdfText(title, body, titleSize, 650);
  while (titleLines.length > 2 && titleSize > 10) {
    titleSize -= 1;
    titleLines = wrapPdfText(title, body, titleSize, 650);
  }
  if (titleLines.length > 2) titleLines = [title];
  titleLines.forEach((line, index) => text(line, 181 - index * 17, titleSize));
  text(`Awarded on ${dateFormat.format(certificate.awardedAt)}`, 135, 13, { color: slate });

  const signatures = [
    { x: 284, name: certificate.coordinator, role: "Research Coordinator" },
    { x: width - 284, name: certificate.dean, role: "Dean of the Department" },
  ];
  for (const { x, name, role } of signatures) {
    page.drawLine({ start: { x: x - 97, y: 93 }, end: { x: x + 97, y: 93 }, thickness: 0.8, color: slate });
    text(name, 76, 13, { center: x, maxWidth: 194 });
    text(role, 59, 11, { center: x, color: slate });
  }

  logo(advisio, 61, 52, 29, 0.48);
  text("Advisio", 48, 10, { center: 101, color: slate });
  logo(qr, width - 68, 81, 88);
  text("Scan to verify", 25, 9, { center: width - 68, color: slate });
  return Buffer.from(await pdf.save());
}
