import { getMimeTypeForFilename } from "@/lib/asset-categories";

export type FileRenderMode = "image" | "pdf" | "text" | "csv" | "spreadsheet" | "office" | "unsupported";

const OFFICE_MIME_TYPES = new Set([
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

const SPREADSHEET_PREVIEW_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

export type FilePreviewInput = {
  filename: string;
  contentType?: string | null;
};

export function normalizeContentType(contentType?: string | null) {
  return contentType?.split(";")[0]?.trim().toLowerCase() || null;
}

export function resolveFileContentType(input: FilePreviewInput) {
  return normalizeContentType(input.contentType) ?? getMimeTypeForFilename(input.filename);
}

export function isOfficePreviewType(contentType?: string | null) {
  const normalized = normalizeContentType(contentType);
  return normalized ? OFFICE_MIME_TYPES.has(normalized) : false;
}

export function getFileRenderMode(contentType?: string | null): FileRenderMode {
  const normalized = normalizeContentType(contentType);
  if (!normalized) return "unsupported";
  if (normalized.startsWith("image/")) return "image";
  if (normalized === "application/pdf") return "pdf";
  if (normalized === "text/plain") return "text";
  if (normalized === "text/csv") return "csv";
  if (SPREADSHEET_PREVIEW_MIME_TYPES.has(normalized)) return "spreadsheet";
  if (OFFICE_MIME_TYPES.has(normalized)) return "office";
  return "unsupported";
}

export function getFilePreviewInfo(input: FilePreviewInput) {
  const contentType = resolveFileContentType(input);
  return {
    contentType,
    renderMode: getFileRenderMode(contentType),
  };
}

export function getOriginalContentUrl(fileId: string, options: { download?: boolean } = {}) {
  const suffix = options.download ? "?download=1" : "";
  return `/api/files/${encodeURIComponent(fileId)}/content${suffix}`;
}

export function getPreviewContentUrl(fileId: string) {
  return `/api/files/${encodeURIComponent(fileId)}/preview-content`;
}

export function getSpreadsheetPreviewUrl(fileId: string) {
  return `/api/files/${encodeURIComponent(fileId)}/spreadsheet-preview`;
}

export function getPreviewMetadataUrl(fileId: string) {
  return `/api/files/${encodeURIComponent(fileId)}/preview`;
}

function getExtension(filename: string) {
  const match = filename.match(/\.([A-Za-z0-9]{1,10})$/);
  return match ? `.${match[1]}` : "";
}

export function getDownloadFilename(displayName: string | null | undefined, originalName: string) {
  const safeDisplayName = displayName?.trim() || originalName;
  if (getExtension(safeDisplayName)) return safeDisplayName;

  const originalExtension = getExtension(originalName);
  return originalExtension ? `${safeDisplayName}${originalExtension}` : safeDisplayName;
}
