// Server-side flattening of marks onto the original document, producing a new
// PDF (the "marked-up version"). The original file is never modified. Marks are
// stored normalized, so geometry maps cleanly to pdf-lib page points here.
//
// Coordinate notes: PDF user space has a bottom-left origin (y up). For shapes
// drawn with explicit centers/endpoints (ellipse, arrow, pin) we flip y with
// `H - ny*H`. For path-based shapes (pen, cloud) we hand pdf-lib an SVG path in
// top-left/pixel-like points and anchor it at (0, H); drawSvgPath's y-down
// convention then lands each point at the right place.

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { buildArrowHead, buildCloudPath } from "./geometry";
import type { Mark } from "./types";

export type FlattenInput = {
  mode: "pdf" | "image";
  baseBytes: Uint8Array;
  imageContentType?: string | null;
  marks: Mark[];
};

const INDEX_PAGE = { width: 612, height: 792 }; // US Letter

export async function flattenMarkupToPdf(input: FlattenInput): Promise<Uint8Array> {
  const marks = input.marks.filter((m) => !m.deletedAt);
  const pinNumbers = numberPins(marks);

  const doc = input.mode === "pdf" ? await PDFDocument.load(input.baseBytes) : await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);

  if (input.mode === "image") {
    const image = await embedImage(doc, input.baseBytes, input.imageContentType);
    const page = doc.addPage([image.width, image.height]);
    page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
  }

  const pages = doc.getPages();
  for (const mark of marks) {
    const page = pages[mark.page - 1];
    if (page) drawMark(page, mark, boldFont, pinNumbers.get(mark.id));
  }

  const commented = marks
    .filter((m) => m.kind === "PIN" && m.text && m.text.trim())
    .sort((a, b) => (pinNumbers.get(a.id) ?? 0) - (pinNumbers.get(b.id) ?? 0));
  if (commented.length > 0) drawCommentIndex(doc, commented, pinNumbers, font, boldFont);

  return doc.save();
}

function numberPins(marks: Mark[]): Map<string, number> {
  const map = new Map<string, number>();
  marks
    .filter((m) => m.kind === "PIN")
    .sort((a, b) => a.sequence - b.sequence)
    .forEach((m, i) => map.set(m.id, i + 1));
  return map;
}

function drawMark(page: PDFPage, mark: Mark, font: PDFFont, pinNumber: number | undefined) {
  const { width: W, height: H } = page.getSize();
  const color = hexColor(mark.style.color);
  const thickness = Math.max(0.5, mark.style.strokeWidth * Math.min(W, H));
  const opacity = mark.style.opacity;

  switch (mark.kind) {
    case "PEN": {
      const d = mark.geometry.points
        .map((p, i) => `${i === 0 ? "M" : "L"} ${(p.x * W).toFixed(2)} ${(p.y * H).toFixed(2)}`)
        .join(" ");
      page.drawSvgPath(d, { x: 0, y: H, borderColor: color, borderWidth: thickness, borderOpacity: opacity });
      break;
    }
    case "CLOUD": {
      const d = buildCloudPath({ x: mark.geometry.x * W, y: mark.geometry.y * H, w: mark.geometry.w * W, h: mark.geometry.h * H });
      page.drawSvgPath(d, { x: 0, y: H, borderColor: color, borderWidth: thickness, borderOpacity: opacity });
      break;
    }
    case "ELLIPSE": {
      const cx = (mark.geometry.x + mark.geometry.w / 2) * W;
      const cyTop = (mark.geometry.y + mark.geometry.h / 2) * H;
      page.drawEllipse({
        x: cx,
        y: H - cyTop,
        xScale: (mark.geometry.w / 2) * W,
        yScale: (mark.geometry.h / 2) * H,
        borderColor: color,
        borderWidth: thickness,
        borderOpacity: opacity,
      });
      break;
    }
    case "ARROW": {
      const from = { x: mark.geometry.x1 * W, y: H - mark.geometry.y1 * H };
      const to = { x: mark.geometry.x2 * W, y: H - mark.geometry.y2 * H };
      const head = buildArrowHead(from, to, { size: Math.max(8, thickness * 3.5) });
      page.drawLine({ start: from, end: to, thickness, color, opacity });
      page.drawLine({ start: head.left, end: to, thickness, color, opacity });
      page.drawLine({ start: head.right, end: to, thickness, color, opacity });
      break;
    }
    case "PIN": {
      const x = mark.geometry.x * W;
      const y = H - mark.geometry.y * H;
      const radius = 10;
      page.drawCircle({ x, y, size: radius, color, opacity });
      const label = String(pinNumber ?? "");
      const size = 11;
      const textWidth = font.widthOfTextAtSize(label, size);
      page.drawText(label, { x: x - textWidth / 2, y: y - size / 2.8, size, font, color: rgb(1, 1, 1) });
      break;
    }
  }
}

function drawCommentIndex(
  doc: PDFDocument,
  pins: Mark[],
  pinNumbers: Map<string, number>,
  font: PDFFont,
  boldFont: PDFFont,
) {
  const margin = 56;
  const fontSize = 11;
  const lineHeight = 16;
  const maxWidth = INDEX_PAGE.width - margin * 2 - 28;
  let page = doc.addPage([INDEX_PAGE.width, INDEX_PAGE.height]);
  let y = INDEX_PAGE.height - margin;

  page.drawText("Markup comments", { x: margin, y, size: 16, font: boldFont, color: rgb(0.1, 0.1, 0.1) });
  y -= lineHeight * 2;

  for (const pin of pins) {
    const number = String(pinNumbers.get(pin.id) ?? "");
    const lines = wrapText(pin.text?.trim() ?? "", font, fontSize, maxWidth);
    const blockHeight = Math.max(lineHeight, lines.length * lineHeight);
    if (y - blockHeight < margin) {
      page = doc.addPage([INDEX_PAGE.width, INDEX_PAGE.height]);
      y = INDEX_PAGE.height - margin;
    }
    page.drawText(`${number}.`, { x: margin, y, size: fontSize, font: boldFont, color: rgb(0.1, 0.1, 0.1) });
    lines.forEach((line, i) => {
      page.drawText(line, { x: margin + 24, y: y - i * lineHeight, size: fontSize, font, color: rgb(0.2, 0.2, 0.2) });
    });
    y -= blockHeight + 6;
  }
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  if (!text) return [""];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

async function embedImage(doc: PDFDocument, bytes: Uint8Array, contentType?: string | null) {
  const isPng = (contentType ?? "").toLowerCase().includes("png");
  if (isPng) return doc.embedPng(bytes);
  try {
    return await doc.embedJpg(bytes);
  } catch {
    return doc.embedPng(bytes);
  }
}

function hexColor(hex: string) {
  const normalized = hex.replace("#", "");
  const value =
    normalized.length === 3
      ? normalized.split("").map((c) => c + c).join("")
      : normalized.padEnd(6, "0").slice(0, 6);
  const r = parseInt(value.slice(0, 2), 16) / 255;
  const g = parseInt(value.slice(2, 4), 16) / 255;
  const b = parseInt(value.slice(4, 6), 16) / 255;
  return rgb(Number.isFinite(r) ? r : 0, Number.isFinite(g) ? g : 0, Number.isFinite(b) ? b : 0);
}
