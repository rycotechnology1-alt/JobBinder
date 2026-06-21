import { inflateSync } from "node:zlib";
import { degrees, PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { displayPointToPdfPoint, flattenMarkupToPdf, getPdfPageDisplayTransform } from "./flatten";
import type { Mark } from "./types";

// 1x1 transparent PNG.
const PNG_1x1 = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
    "base64",
  ),
);

async function makeBasePdf(pageCount = 2): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pageCount; i += 1) doc.addPage([600, 800]);
  return doc.save();
}

async function pageCount(bytes: Uint8Array): Promise<number> {
  return (await PDFDocument.load(bytes)).getPageCount();
}

async function pageContent(bytes: Uint8Array): Promise<string> {
  const doc = await PDFDocument.load(bytes);
  const contents = doc.getPage(0).node.Contents() as unknown as { asArray?: () => unknown[] };
  const refs = contents.asArray?.() ?? [contents];
  return refs
    .map((ref) => {
      const stream = doc.context.lookup(ref) as { getContents: () => Uint8Array };
      return inflateSync(Buffer.from(stream.getContents())).toString("latin1");
    })
    .join("\n");
}

const style = { color: "#ef4444", strokeWidth: 0.004, opacity: 1 };
const base = { fileId: "f", page: 1, sequence: 0, clientUpdatedAt: "2026-06-13T12:00:00.000Z", style };

const everyShape: Mark[] = [
  { ...base, id: "pen", kind: "PEN", geometry: { points: [{ x: 0.1, y: 0.1 }, { x: 0.3, y: 0.4 }, { x: 0.5, y: 0.2 }] } },
  { ...base, id: "ell", kind: "ELLIPSE", geometry: { x: 0.2, y: 0.2, w: 0.3, h: 0.2 } },
  { ...base, id: "cloud", kind: "CLOUD", geometry: { x: 0.4, y: 0.5, w: 0.4, h: 0.3 } },
  { ...base, id: "arrow", kind: "ARROW", geometry: { x1: 0.1, y1: 0.8, x2: 0.6, y2: 0.6 } },
  { ...base, id: "pin", kind: "PIN", geometry: { x: 0.7, y: 0.3 } },
];

describe("flattenMarkupToPdf (PDF original)", () => {
  it("draws every shape kind and returns a loadable PDF with the same page count", async () => {
    const out = await flattenMarkupToPdf({ mode: "pdf", baseBytes: await makeBasePdf(2), marks: everyShape });
    expect(await pageCount(out)).toBe(2); // no commented pins → no index page
  });

  it("appends a comment index page when pins have comments", async () => {
    const marks: Mark[] = [
      { ...base, id: "p1", kind: "PIN", geometry: { x: 0.3, y: 0.3 }, text: "Patch the drywall here", sequence: 0 },
      { ...base, id: "p2", kind: "PIN", geometry: { x: 0.6, y: 0.6 }, text: "Verify outlet spacing", sequence: 1 },
    ];
    const out = await flattenMarkupToPdf({ mode: "pdf", baseBytes: await makeBasePdf(2), marks });
    expect(await pageCount(out)).toBe(3); // 2 original + 1 index
  });

  it("appends a comment index page when pins have image attachments", async () => {
    const marks: Mark[] = [
      { ...base, id: "p1", kind: "PIN", geometry: { x: 0.3, y: 0.3 }, sequence: 0 },
    ];
    const out = await flattenMarkupToPdf({
      mode: "pdf",
      baseBytes: await makeBasePdf(1),
      marks,
      pinAttachments: [
        {
          markId: "p1",
          id: "file-1",
          filename: "pin-photo.png",
          contentType: "image/png",
          bytes: PNG_1x1,
        },
      ],
    });
    expect(await pageCount(out)).toBe(2); // original + attachment/comment index
  });

  it("ignores soft-deleted marks", async () => {
    const marks: Mark[] = [
      { ...base, id: "p1", kind: "PIN", geometry: { x: 0.3, y: 0.3 }, text: "Gone", sequence: 0, deletedAt: "2026-06-13T12:30:00.000Z" },
    ];
    const out = await flattenMarkupToPdf({ mode: "pdf", baseBytes: await makeBasePdf(2), marks });
    expect(await pageCount(out)).toBe(2); // deleted pin → no index page
  });
  it("draws arrow and pin marks in a rotated PDF display coordinate system", async () => {
    const out = await flattenMarkupToPdf({
      mode: "pdf",
      baseBytes: await makeRotatedPdf({ width: 2160, height: 3024, rotation: 270 }),
      marks: [
        { ...base, id: "arrow-rotated", kind: "ARROW", geometry: { x1: 0.32, y1: 0.58, x2: 0.25, y2: 0.69 } },
        { ...base, id: "pin-rotated", kind: "PIN", geometry: { x: 0.24, y: 0.72 }, sequence: 0 },
      ],
    });

    const content = await pageContent(out);
    expect(content).toContain("0 -1 -1 0 2160 3024 cm");
  });

  it("draws arrow and pin marks in an unrotated PDF display coordinate system", async () => {
    const out = await flattenMarkupToPdf({
      mode: "pdf",
      baseBytes: await makeRotatedPdf({ width: 600, height: 800, rotation: 0 }),
      marks: [
        { ...base, id: "arrow-unrotated", kind: "ARROW", geometry: { x1: 0.1, y1: 0.2, x2: 0.4, y2: 0.5 } },
        { ...base, id: "pin-unrotated", kind: "PIN", geometry: { x: 0.5, y: 0.6 }, sequence: 0 },
      ],
    });

    const content = await pageContent(out);
    expect(content).toContain("1 0 0 -1 0 800 cm");
  });
});

describe("PDF display transform", () => {
  it.each([0, 90, 180, 270])("matches pdf.js PageViewport output for rotation %s", async (rotation) => {
    const bytes = await makeRotatedPdf({ width: 2160, height: 3024, rotation });
    const pdfLibDoc = await PDFDocument.load(bytes);
    const page = pdfLibDoc.getPage(0);
    const display = getPdfPageDisplayTransform(page);
    const viewport = await loadPdfjsViewport(bytes);

    expect(display.width).toBeCloseTo(viewport.width, 6);
    expect(display.height).toBeCloseTo(viewport.height, 6);
    expect(display.pdfToDisplay).toHaveLength(6);
    display.pdfToDisplay.forEach((value, index) => {
      expect(value).toBeCloseTo(viewport.transform[index], 6);
    });

    const displayPoint = { x: display.width * 0.27, y: display.height * 0.63 };
    const ours = displayPointToPdfPoint(display, displayPoint);
    const theirs = viewport.convertToPdfPoint(displayPoint.x, displayPoint.y);
    expect(ours.x).toBeCloseTo(theirs[0], 6);
    expect(ours.y).toBeCloseTo(theirs[1], 6);
  });

  it("uses the crop box as the visible display viewport", async () => {
    const bytes = await makeRotatedPdf({
      width: 1000,
      height: 1400,
      rotation: 90,
      cropBox: { x: 100, y: 200, width: 600, height: 900 },
    });
    const pdfLibDoc = await PDFDocument.load(bytes);
    const display = getPdfPageDisplayTransform(pdfLibDoc.getPage(0));
    const viewport = await loadPdfjsViewport(bytes);

    expect(display.width).toBeCloseTo(900, 6);
    expect(display.height).toBeCloseTo(600, 6);
    display.pdfToDisplay.forEach((value, index) => {
      expect(value).toBeCloseTo(viewport.transform[index], 6);
    });
  });
});

describe("flattenMarkupToPdf (image original)", () => {
  it("embeds the image as page 1 and appends a comment index", async () => {
    const marks: Mark[] = [
      { ...base, id: "p1", kind: "PIN", geometry: { x: 0.5, y: 0.5 }, text: "Damage here", sequence: 0 },
    ];
    const out = await flattenMarkupToPdf({ mode: "image", baseBytes: PNG_1x1, imageContentType: "image/png", marks });
    expect(await pageCount(out)).toBe(2); // image page + index
  });

  it("produces a single image page when there are no comments", async () => {
    const out = await flattenMarkupToPdf({ mode: "image", baseBytes: PNG_1x1, imageContentType: "image/png", marks: everyShape });
    expect(await pageCount(out)).toBe(1);
  });
});

async function makeRotatedPdf(input: {
  width: number;
  height: number;
  rotation: number;
  cropBox?: { x: number; y: number; width: number; height: number };
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([input.width, input.height]);
  page.setRotation(degrees(input.rotation));
  if (input.cropBox) {
    page.setCropBox(input.cropBox.x, input.cropBox.y, input.cropBox.width, input.cropBox.height);
  }
  return doc.save();
}

async function loadPdfjsViewport(bytes: Uint8Array) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const data = new Uint8Array(bytes);
  const doc = await pdfjs.getDocument({ data, disableWorker: true }).promise;
  const page = await doc.getPage(1);
  const viewport = page.getViewport({ scale: 1 });
  await doc.destroy();
  return viewport;
}
