import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { flattenMarkupToPdf } from "./flatten";
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

  it("ignores soft-deleted marks", async () => {
    const marks: Mark[] = [
      { ...base, id: "p1", kind: "PIN", geometry: { x: 0.3, y: 0.3 }, text: "Gone", sequence: 0, deletedAt: "2026-06-13T12:30:00.000Z" },
    ];
    const out = await flattenMarkupToPdf({ mode: "pdf", baseBytes: await makeBasePdf(2), marks });
    expect(await pageCount(out)).toBe(2); // deleted pin → no index page
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
