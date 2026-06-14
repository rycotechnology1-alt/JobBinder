// Shared logic for producing the flattened "marked-up" PDF for a file. Used by
// the single-file download route and the job-package export so both share one
// cache row (FileMarkupExport) and one R2 key convention.

import prisma from "@/lib/prisma";
import { downloadR2Object, uploadR2Object } from "@/lib/r2";
import { getFilePreviewInfo } from "@/lib/file-preview";
import { flattenMarkupToPdf } from "@/lib/markup/flatten";
import { serializeMark, type DbMarkRow } from "@/lib/markup/serialize";

export type MarkupSourceFile = {
  id: string;
  url: string;
  originalName: string;
  name: string | null;
  contentType: string | null;
};

export function markupFilename(displayName: string | null, originalName: string) {
  const base = (displayName?.trim() || originalName).replace(/\.[A-Za-z0-9]{1,10}$/, "");
  return `${base} (marked up).pdf`;
}

/**
 * Returns the R2 storage key of the flattened marked-up PDF for a file, generating
 * and caching it when missing or stale. Returns null if the file isn't markup-eligible
 * (only PDFs and images can be marked up).
 */
export async function ensureFileMarkupPdf(params: {
  file: MarkupSourceFile;
  companyId: string;
}): Promise<{ storageKey: string } | null> {
  const { file, companyId } = params;

  const filename = file.name || file.originalName;
  const { renderMode, contentType } = getFilePreviewInfo({ filename, contentType: file.contentType });
  if (renderMode !== "pdf" && renderMode !== "image") {
    return null;
  }

  const cached = await prisma.fileMarkupExport.findUnique({ where: { fileId: file.id } });
  if (cached && !cached.isStale && cached.storageKey) {
    return { storageKey: cached.storageKey };
  }

  const rows = (await prisma.fileMarkupMark.findMany({
    where: { fileId: file.id, deletedAt: null },
    orderBy: { sequence: "asc" },
  })) as DbMarkRow[];

  const baseBytes = await downloadR2Object(file.url);
  const pdfBytes = await flattenMarkupToPdf({
    mode: renderMode,
    baseBytes,
    imageContentType: contentType,
    marks: rows.map(serializeMark),
  });

  const storageKey = `${companyId}/${file.id}-markup.pdf`;
  await uploadR2Object(storageKey, pdfBytes, "application/pdf");
  await prisma.fileMarkupExport.upsert({
    where: { fileId: file.id },
    create: { fileId: file.id, storageKey, isStale: false, generatedAt: new Date() },
    update: { storageKey, isStale: false, generatedAt: new Date() },
  });

  return { storageKey };
}
