// Server-side flattening of marks onto the original document, producing a new
// PDF (the "marked-up version"). The original file is never modified. Marks are
// stored normalized against the same top-left display viewport that pdf.js uses
// in the preview. PDF export maps that display space back into each page's PDF
// user space, accounting for crop boxes and /Rotate metadata.

import {
  concatTransformationMatrix,
  degrees,
  PDFDocument,
  PDFName,
  PDFNumber,
  popGraphicsState,
  pushGraphicsState,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
import { buildArrowHead, buildCloudPath } from "./geometry";
import type { Mark } from "./types";

export type FlattenInput = {
  mode: "pdf" | "image";
  baseBytes: Uint8Array;
  imageContentType?: string | null;
  marks: Mark[];
  pinAttachments?: FlattenPinAttachment[];
};

export type FlattenPinAttachment = {
  markId: string;
  id: string;
  filename: string;
  contentType?: string | null;
  bytes?: Uint8Array;
};

const INDEX_PAGE = { width: 612, height: 792 }; // US Letter
const PIN_RADIUS = 13;

type Matrix = [number, number, number, number, number, number];

export type PdfPageDisplayTransform = {
  width: number;
  height: number;
  rotation: number;
  pdfToDisplay: Matrix;
  displayToPdf: Matrix;
};

export async function flattenMarkupToPdf(input: FlattenInput): Promise<Uint8Array> {
  const marks = input.marks.filter((m) => !m.deletedAt);
  const pinNumbers = numberPins(marks);
  const attachmentsByMark = groupPinAttachments(input.pinAttachments ?? []);

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
    .filter((m) => m.kind === "PIN" && ((m.text && m.text.trim()) || (attachmentsByMark.get(m.id)?.length ?? 0) > 0))
    .sort((a, b) => (pinNumbers.get(a.id) ?? 0) - (pinNumbers.get(b.id) ?? 0));
  if (commented.length > 0) await drawCommentIndex(doc, commented, pinNumbers, font, boldFont, attachmentsByMark);

  return doc.save();
}

function groupPinAttachments(attachments: FlattenPinAttachment[]) {
  const map = new Map<string, FlattenPinAttachment[]>();
  for (const attachment of attachments) {
    const list = map.get(attachment.markId) ?? [];
    list.push(attachment);
    map.set(attachment.markId, list);
  }
  return map;
}

function numberPins(marks: Mark[]): Map<string, number> {
  const map = new Map<string, number>();
  marks
    .filter((m) => m.kind === "PIN")
    .sort((a, b) => a.sequence - b.sequence)
    .forEach((m, i) => map.set(m.id, i + 1));
  return map;
}

export function getPdfPageDisplayTransform(page: PDFPage): PdfPageDisplayTransform {
  const cropBox = page.getCropBox();
  const viewBox: [number, number, number, number] = [
    cropBox.x,
    cropBox.y,
    cropBox.x + cropBox.width,
    cropBox.y + cropBox.height,
  ];
  const pdfToDisplay = buildPdfjsViewportTransform(viewBox, normalizeRotation(page.getRotation().angle), getPageUserUnit(page));
  return {
    width: pdfToDisplay.width,
    height: pdfToDisplay.height,
    rotation: pdfToDisplay.rotation,
    pdfToDisplay: pdfToDisplay.transform,
    displayToPdf: invertMatrix(pdfToDisplay.transform),
  };
}

export function displayPointToPdfPoint(transform: PdfPageDisplayTransform, point: { x: number; y: number }) {
  return applyMatrix(transform.displayToPdf, point);
}

function drawMark(page: PDFPage, mark: Mark, font: PDFFont, pinNumber: number | undefined) {
  const display = getPdfPageDisplayTransform(page);
  const { width: W, height: H } = display;
  const color = hexColor(mark.style.color);
  const thickness = Math.max(0.5, mark.style.strokeWidth * Math.min(W, H));
  const opacity = mark.style.opacity;

  switch (mark.kind) {
    case "PEN": {
      const d = mark.geometry.points
        .map((p, i) => `${i === 0 ? "M" : "L"} ${(p.x * W).toFixed(2)} ${(-p.y * H).toFixed(2)}`)
        .join(" ");
      drawInDisplaySpace(page, display, () => {
        page.drawSvgPath(d, { x: 0, y: 0, borderColor: color, borderWidth: thickness, borderOpacity: opacity });
      });
      break;
    }
    case "CLOUD": {
      const d = buildCloudPath({
        x: mark.geometry.x * W,
        y: -mark.geometry.y * H,
        w: mark.geometry.w * W,
        h: -mark.geometry.h * H,
      });
      drawInDisplaySpace(page, display, () => {
        page.drawSvgPath(d, { x: 0, y: 0, borderColor: color, borderWidth: thickness, borderOpacity: opacity });
      });
      break;
    }
    case "ELLIPSE": {
      const cx = (mark.geometry.x + mark.geometry.w / 2) * W;
      const cy = (mark.geometry.y + mark.geometry.h / 2) * H;
      drawInDisplaySpace(page, display, () => {
        page.drawEllipse({
          x: cx,
          y: cy,
          xScale: (mark.geometry.w / 2) * W,
          yScale: (mark.geometry.h / 2) * H,
          borderColor: color,
          borderWidth: thickness,
          borderOpacity: opacity,
        });
      });
      break;
    }
    case "ARROW": {
      const from = { x: mark.geometry.x1 * W, y: mark.geometry.y1 * H };
      const to = { x: mark.geometry.x2 * W, y: mark.geometry.y2 * H };
      const head = buildArrowHead(from, to, { size: Math.max(8, thickness * 3.5) });
      drawInDisplaySpace(page, display, () => {
        page.drawLine({ start: from, end: to, thickness, color, opacity });
        page.drawLine({ start: head.left, end: to, thickness, color, opacity });
        page.drawLine({ start: head.right, end: to, thickness, color, opacity });
      });
      break;
    }
    case "PIN": {
      const x = mark.geometry.x * W;
      const y = mark.geometry.y * H;
      drawInDisplaySpace(page, display, () => {
        page.drawSvgPath(pinTailPath({ x, y }), { x: 0, y: 0, color, opacity });
        page.drawCircle({ x, y: y - PIN_RADIUS, size: PIN_RADIUS, color, opacity });
      });
      const label = String(pinNumber ?? "");
      const size = 11;
      const center = { x, y: y - PIN_RADIUS };
      const textWidth = font.widthOfTextAtSize(label, size);
      const origin = displayPointToPdfPoint(display, { x: center.x - textWidth / 2, y: center.y + size / 2.8 });
      page.drawText(label, {
        x: origin.x,
        y: origin.y,
        size,
        font,
        color: rgb(1, 1, 1),
        rotate: degrees((360 - display.rotation) % 360),
      });
      break;
    }
  }
}

function drawInDisplaySpace(page: PDFPage, display: PdfPageDisplayTransform, draw: () => void) {
  page.pushOperators(pushGraphicsState(), concatTransformationMatrix(...display.displayToPdf));
  try {
    draw();
  } finally {
    page.pushOperators(popGraphicsState());
  }
}

function pinTailPath(point: { x: number; y: number }) {
  return [
    `M ${round(point.x)} ${round(-point.y)}`,
    `L ${round(point.x - PIN_RADIUS * 0.7)} ${round(-(point.y - PIN_RADIUS))}`,
    `L ${round(point.x + PIN_RADIUS * 0.7)} ${round(-(point.y - PIN_RADIUS))}`,
    "Z",
  ].join(" ");
}

function buildPdfjsViewportTransform(viewBox: [number, number, number, number], rotation: number, userUnit: number) {
  const scale = userUnit;
  const centerX = (viewBox[2] + viewBox[0]) / 2;
  const centerY = (viewBox[3] + viewBox[1]) / 2;
  let rotateA: number;
  let rotateB: number;
  let rotateC: number;
  let rotateD: number;

  switch (rotation) {
    case 180:
      rotateA = -1;
      rotateB = 0;
      rotateC = 0;
      rotateD = 1;
      break;
    case 90:
      rotateA = 0;
      rotateB = 1;
      rotateC = 1;
      rotateD = 0;
      break;
    case 270:
      rotateA = 0;
      rotateB = -1;
      rotateC = -1;
      rotateD = 0;
      break;
    case 0:
      rotateA = 1;
      rotateB = 0;
      rotateC = 0;
      rotateD = -1;
      break;
    default:
      throw new Error("PDF page rotation must be a multiple of 90 degrees.");
  }

  let offsetCanvasX: number;
  let offsetCanvasY: number;
  let width: number;
  let height: number;
  if (rotateA === 0) {
    offsetCanvasX = Math.abs(centerY - viewBox[1]) * scale;
    offsetCanvasY = Math.abs(centerX - viewBox[0]) * scale;
    width = (viewBox[3] - viewBox[1]) * scale;
    height = (viewBox[2] - viewBox[0]) * scale;
  } else {
    offsetCanvasX = Math.abs(centerX - viewBox[0]) * scale;
    offsetCanvasY = Math.abs(centerY - viewBox[1]) * scale;
    width = (viewBox[2] - viewBox[0]) * scale;
    height = (viewBox[3] - viewBox[1]) * scale;
  }

  const transform: Matrix = [
    rotateA * scale,
    rotateB * scale,
    rotateC * scale,
    rotateD * scale,
    offsetCanvasX - rotateA * scale * centerX - rotateC * scale * centerY,
    offsetCanvasY - rotateB * scale * centerX - rotateD * scale * centerY,
  ];

  return { width, height, rotation, transform };
}

function getPageUserUnit(page: PDFPage): number {
  const userUnit = page.node.getInheritableAttribute(PDFName.of("UserUnit"));
  if (userUnit instanceof PDFNumber) return userUnit.asNumber();
  return 1;
}

function normalizeRotation(rotation: number): number {
  const normalized = rotation % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

function invertMatrix(matrix: Matrix): Matrix {
  const [a, b, c, d, e, f] = matrix;
  const determinant = a * d - b * c;
  if (determinant === 0) throw new Error("PDF page display transform is not invertible.");
  return [
    d / determinant,
    -b / determinant,
    -c / determinant,
    a / determinant,
    (c * f - d * e) / determinant,
    (b * e - a * f) / determinant,
  ];
}

function applyMatrix(matrix: Matrix, point: { x: number; y: number }) {
  const [a, b, c, d, e, f] = matrix;
  return {
    x: a * point.x + c * point.y + e,
    y: b * point.x + d * point.y + f,
  };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

async function drawCommentIndex(
  doc: PDFDocument,
  pins: Mark[],
  pinNumbers: Map<string, number>,
  font: PDFFont,
  boldFont: PDFFont,
  attachmentsByMark: Map<string, FlattenPinAttachment[]>,
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
    const lines = pin.text?.trim() ? wrapText(pin.text.trim(), font, fontSize, maxWidth) : [];
    const attachments = attachmentsByMark.get(pin.id) ?? [];
    const blockHeight = Math.max(lineHeight, lines.length * lineHeight);
    if (y - blockHeight < margin) {
      page = doc.addPage([INDEX_PAGE.width, INDEX_PAGE.height]);
      y = INDEX_PAGE.height - margin;
    }
    page.drawText(`${number}.`, { x: margin, y, size: fontSize, font: boldFont, color: rgb(0.1, 0.1, 0.1) });
    if (lines.length === 0) {
      page.drawText("Attached image", { x: margin + 24, y, size: fontSize, font, color: rgb(0.35, 0.35, 0.35) });
      y -= lineHeight;
    }
    lines.forEach((line, i) => {
      page.drawText(line, { x: margin + 24, y: y - i * lineHeight, size: fontSize, font, color: rgb(0.2, 0.2, 0.2) });
    });
    if (lines.length > 0) y -= blockHeight + 6;

    for (const attachment of attachments) {
      if (y - 116 < margin) {
        page = doc.addPage([INDEX_PAGE.width, INDEX_PAGE.height]);
        y = INDEX_PAGE.height - margin;
      }

      page.drawText(attachment.filename, {
        x: margin + 24,
        y,
        size: 9,
        font: boldFont,
        color: rgb(0.25, 0.25, 0.25),
      });
      y -= 12;

      const image = await tryEmbedAttachmentImage(doc, attachment);
      if (image) {
        const maxWidth = 128;
        const maxHeight = 96;
        const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
        const width = image.width * scale;
        const height = image.height * scale;
        page.drawImage(image, {
          x: margin + 24,
          y: y - height,
          width,
          height,
        });
        y -= height + 10;
      } else {
        page.drawText("Preview unavailable for this attachment.", {
          x: margin + 24,
          y,
          size: 8,
          font,
          color: rgb(0.45, 0.45, 0.45),
        });
        y -= 14;
      }
    }

    y -= 6;
  }
}

async function tryEmbedAttachmentImage(doc: PDFDocument, attachment: FlattenPinAttachment) {
  if (!attachment.bytes) return null;
  try {
    return await embedImage(doc, attachment.bytes, attachment.contentType);
  } catch {
    return null;
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
