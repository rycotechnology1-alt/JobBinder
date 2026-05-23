import { PDFDocument } from "pdf-lib";
import type { ScanicPage } from "./scanicTypes";

const DEFAULT_MAX_LONG_EDGE = 2400;
const DEFAULT_JPEG_QUALITY = 0.82;

type Dimensions = {
  width: number;
  height: number;
};

function pad(value: number) {
  return value.toString().padStart(2, "0");
}

function sanitizeBaseName(baseName: string) {
  return baseName.trim().replace(/[<>:"/\\|?*\u0000-\u001F]/g, "").replace(/\s+/g, " ") || "Scanned Document";
}

export function buildScannedDocumentFileName(baseName = "Scanned Document", date = new Date()) {
  const safeBaseName = sanitizeBaseName(baseName).replace(/\.pdf$/i, "");
  const timestamp = [
    date.getFullYear(),
    "-",
    pad(date.getMonth() + 1),
    "-",
    pad(date.getDate()),
    " ",
    pad(date.getHours()),
    "-",
    pad(date.getMinutes()),
  ].join("");

  return `${safeBaseName} - ${timestamp}.pdf`;
}

export function getPdfPageSize(dimensions: Dimensions): Dimensions {
  return {
    width: Math.max(1, Math.round(dimensions.width)),
    height: Math.max(1, Math.round(dimensions.height)),
  };
}

export function getScaledImageDimensions(dimensions: Dimensions, maxLongEdge = DEFAULT_MAX_LONG_EDGE): Dimensions {
  const longEdge = Math.max(dimensions.width, dimensions.height);
  if (longEdge <= maxLongEdge) return getPdfPageSize(dimensions);

  const scale = maxLongEdge / longEdge;
  return {
    width: Math.max(1, Math.round(dimensions.width * scale)),
    height: Math.max(1, Math.round(dimensions.height * scale)),
  };
}

function dataUrlToBlob(dataUrl: string, type: string) {
  const [, base64] = dataUrl.split(",");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type });
}

export function canvasToBlob(
  canvas: HTMLCanvasElement,
  type = "image/jpeg",
  quality = DEFAULT_JPEG_QUALITY,
): Promise<Blob> {
  if (canvas.toBlob) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("Could not create scanned page image."));
          }
        },
        type,
        quality,
      );
    });
  }

  return Promise.resolve(dataUrlToBlob(canvas.toDataURL(type, quality), type));
}

export async function createJpegBlobFromCanvas(
  sourceCanvas: HTMLCanvasElement,
  options: { maxLongEdge?: number; quality?: number } = {},
) {
  const targetSize = getScaledImageDimensions(
    { width: sourceCanvas.width, height: sourceCanvas.height },
    options.maxLongEdge ?? DEFAULT_MAX_LONG_EDGE,
  );

  const outputCanvas = document.createElement("canvas");
  outputCanvas.width = targetSize.width;
  outputCanvas.height = targetSize.height;
  const ctx = outputCanvas.getContext("2d");
  if (!ctx) throw new Error("Could not prepare scanned page image.");

  ctx.drawImage(sourceCanvas, 0, 0, targetSize.width, targetSize.height);
  const blob = await canvasToBlob(outputCanvas, "image/jpeg", options.quality ?? DEFAULT_JPEG_QUALITY);
  return {
    blob,
    width: targetSize.width,
    height: targetSize.height,
  };
}

export async function createPdfFileFromScannedPages(
  pages: ScanicPage[],
  options: {
    defaultFileName?: string;
    createdAt?: Date;
  } = {},
) {
  if (pages.length === 0) {
    throw new Error("Scan at least one page before creating a PDF.");
  }

  const pdf = await PDFDocument.create();

  for (const page of pages) {
    const imageBytes = await page.blob.arrayBuffer();
    const image = await pdf.embedJpg(imageBytes);
    const pageSize = getPdfPageSize({ width: page.width, height: page.height });
    const pdfPage = pdf.addPage([pageSize.width, pageSize.height]);
    pdfPage.drawImage(image, {
      x: 0,
      y: 0,
      width: pageSize.width,
      height: pageSize.height,
    });
  }

  const pdfBytes = await pdf.save();
  const pdfArrayBuffer = pdfBytes.buffer.slice(
    pdfBytes.byteOffset,
    pdfBytes.byteOffset + pdfBytes.byteLength,
  ) as ArrayBuffer;
  const fileName = buildScannedDocumentFileName(options.defaultFileName, options.createdAt);
  return new File([pdfArrayBuffer], fileName, { type: "application/pdf" });
}
