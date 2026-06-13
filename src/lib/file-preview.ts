import { getMimeTypeForFilename } from "@/lib/asset-categories";

export type FileRenderMode = "image" | "pdf" | "text" | "csv" | "spreadsheet" | "docx" | "unsupported";

const SPREADSHEET_PREVIEW_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

const DOCX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

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

export function getFileRenderMode(contentType?: string | null): FileRenderMode {
  const normalized = normalizeContentType(contentType);
  if (!normalized) return "unsupported";
  if (normalized.startsWith("image/")) return "image";
  if (normalized === "application/pdf") return "pdf";
  if (normalized === "text/plain") return "text";
  if (normalized === "text/csv") return "csv";
  if (SPREADSHEET_PREVIEW_MIME_TYPES.has(normalized)) return "spreadsheet";
  if (normalized === DOCX_MIME_TYPE) return "docx";
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
