import type { FileType } from "@prisma/client";

export const ASSET_CATEGORIES = [
  "Before",
  "During",
  "After",
  "Issue",
  "Material",
  "Inspection",
  "Damage",
  "Completed Work",
  "Punch List",
  "Plans",
  "Permits",
  "Quotes",
  "Invoices",
  "Receipts",
  "Cut Sheets",
  "Inspection Documents",
  "Customer Documents",
  "Misc",
] as const;

export type AssetCategory = (typeof ASSET_CATEGORIES)[number];

export const DEFAULT_ASSET_CATEGORY: AssetCategory = "Misc";

const DOCUMENT_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
]);

const EXTENSION_MIME_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain",
  csv: "text/csv",
};

export const LEGACY_DOC_UPLOAD_ERROR = "Legacy .doc files are not supported. Convert the document to .docx before uploading.";

export function normalizeAssetCategory(category: unknown): AssetCategory {
  if (typeof category !== "string") return DEFAULT_ASSET_CATEGORY;

  const trimmedCategory = category.trim();
  return ASSET_CATEGORIES.find((item) => item === trimmedCategory) ?? DEFAULT_ASSET_CATEGORY;
}

export function getFileTypeForMime(contentType: unknown): FileType | null {
  if (typeof contentType !== "string") return null;

  const normalizedContentType = contentType.toLowerCase();
  if (normalizedContentType.startsWith("image/")) return "PHOTO";
  if (DOCUMENT_MIME_TYPES.has(normalizedContentType)) return "DOCUMENT";

  return null;
}

export function getMimeTypeForFilename(filename: string) {
  const extension = filename.split(".").pop()?.toLowerCase();
  if (!extension || extension === filename.toLowerCase()) return null;

  return EXTENSION_MIME_TYPES[extension] ?? null;
}

function hasLegacyDocExtension(filename: unknown) {
  return typeof filename === "string" && /\.doc$/i.test(filename.trim());
}

function normalizeUploadContentType(contentType: unknown) {
  return typeof contentType === "string" ? contentType.split(";")[0]?.trim().toLowerCase() || "" : "";
}

export function validateSupportedUploadType(input: {
  filename?: unknown;
  contentType?: unknown;
}): { ok: true; contentType: string; type: FileType } | { ok: false; error: string } {
  const contentType = normalizeUploadContentType(input.contentType);

  if (hasLegacyDocExtension(input.filename) || contentType === "application/msword") {
    return { ok: false, error: LEGACY_DOC_UPLOAD_ERROR };
  }

  if (!contentType) return { ok: false, error: "Missing contentType" };

  const type = getFileTypeForMime(contentType);
  if (!type) return { ok: false, error: "Unsupported file type" };

  return { ok: true, contentType, type };
}

type UploadInput = {
  originalName?: unknown;
  objectKey?: unknown;
  contentType?: unknown;
  sizeBytes?: unknown;
  category?: unknown;
};

type ValidUploadInput = {
  originalName: string;
  objectKey: string;
  contentType: string;
  sizeBytes: number | null;
  category: AssetCategory;
  type: FileType;
};

export function validateFileUploadInput(
  input: UploadInput,
): { ok: true; value: ValidUploadInput } | { ok: false; error: string } {
  const originalName = typeof input.originalName === "string" ? input.originalName.trim() : "";
  if (!originalName) return { ok: false, error: "Missing originalName" };

  const objectKey = typeof input.objectKey === "string" ? input.objectKey.trim() : "";
  if (!objectKey) return { ok: false, error: "Missing objectKey" };

  const uploadTypeValidation = validateSupportedUploadType({
    filename: originalName,
    contentType: input.contentType,
  });
  if (!uploadTypeValidation.ok) return uploadTypeValidation;

  const sizeBytes = typeof input.sizeBytes === "number" && Number.isFinite(input.sizeBytes) && input.sizeBytes >= 0
    ? Math.round(input.sizeBytes)
    : null;

  return {
    ok: true,
    value: {
      originalName,
      objectKey,
      contentType: uploadTypeValidation.contentType,
      sizeBytes,
      category: normalizeAssetCategory(input.category),
      type: uploadTypeValidation.type,
    },
  };
}
