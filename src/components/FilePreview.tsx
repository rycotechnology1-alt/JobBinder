"use client";

import { useState } from "react";
import { FileIcon, FileText, ImageIcon } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { DeleteConfirmationButton } from "@/components/DeleteConfirmationButton";
import { FileViewerOverlay } from "@/components/FileViewerOverlay";
import { PageSurface } from "@/components/markup/PageSurface";
import { getFilePreviewInfo, getOriginalContentUrl, type FileRenderMode } from "@/lib/file-preview";

type Props = {
  fileId: string;
  type: "PHOTO" | "DOCUMENT";
  filename: string;
  category?: string | null;
  contentType?: string | null;
  sizeBytes?: number | null;
  renderMode?: FileRenderMode;
  canDelete?: boolean;
  onDelete?: () => void;
};

const PDF_THUMBNAIL_SCALE = 0.2;

export function FilePreview({
  fileId,
  type,
  filename,
  category,
  contentType,
  sizeBytes,
  renderMode,
  canDelete = false,
  onDelete,
}: Props) {
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const openFile = () => setIsViewerOpen(true);
  const previewInfo = getFilePreviewInfo({ filename, contentType });
  const resolvedRenderMode = renderMode ?? previewInfo.renderMode;
  const sizeLabel = formatBytes(sizeBytes ?? null);
  const kindLabel = type === "PHOTO" ? "Photo" : "Document";

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-zinc-800 bg-black/20">
        <button
          type="button"
          onClick={openFile}
          aria-label={`Preview ${filename}`}
          className="group relative block aspect-video w-full overflow-hidden bg-zinc-900 text-left"
        >
          <FileThumbnail fileId={fileId} type={type} filename={filename} renderMode={resolvedRenderMode} />
          <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
        </button>

        <div className="flex items-start justify-between gap-3 p-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-zinc-200">{filename}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Badge variant={type === "PHOTO" ? "brand" : "default"}>{kindLabel}</Badge>
              {category && <Badge variant={type === "PHOTO" ? "default" : "brand"}>{category}</Badge>}
            </div>
            {sizeLabel && <p className="mt-1 text-xs text-zinc-500">{sizeLabel}</p>}
          </div>

          {canDelete && onDelete && (
            <DeleteConfirmationButton
              endpoint={`/api/files/${fileId}`}
              label={`Delete ${filename}`}
              title="Delete file"
              message={`Delete ${filename} from this job? This cannot be undone.`}
              onDeleted={onDelete}
            />
          )}
        </div>
      </div>
      <FileViewerOverlay fileId={fileId} isOpen={isViewerOpen} onClose={() => setIsViewerOpen(false)} initialFilename={filename} />
    </>
  );
}

function FileThumbnail({
  fileId,
  type,
  filename,
  renderMode,
}: {
  fileId: string;
  type: "PHOTO" | "DOCUMENT";
  filename: string;
  renderMode: FileRenderMode;
}) {
  const contentUrl = getOriginalContentUrl(fileId);

  if (type === "PHOTO" || renderMode === "image") {
    return <ImageThumbnail src={contentUrl} filename={filename} />;
  }

  if (renderMode === "pdf") {
    return <PdfThumbnail src={contentUrl} />;
  }

  return <TypeThumbnail label={getTypeThumbnailLabel(renderMode, filename)} />;
}

function ImageThumbnail({ src, filename }: { src: string; filename: string }) {
  return (
    <>
      <ImageIcon size={28} className="absolute left-1/2 top-1/2 text-zinc-600 -translate-x-1/2 -translate-y-1/2" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={filename}
        loading="lazy"
        className="absolute inset-0 h-full w-full object-cover"
        onError={(event) => {
          event.currentTarget.style.display = "none";
        }}
      />
    </>
  );
}

function PdfThumbnail({ src }: { src: string }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-zinc-900 p-4">
      <FileText size={34} className="absolute left-1/2 top-1/2 text-zinc-700 -translate-x-1/2 -translate-y-1/2" />
      <div className="pointer-events-none max-h-full max-w-full overflow-hidden rounded-sm bg-white shadow-xl">
        <PageSurface mode="pdf" src={src} pageNumber={1} rasterScale={PDF_THUMBNAIL_SCALE}>
          {() => null}
        </PageSurface>
      </div>
    </div>
  );
}

function TypeThumbnail({ label }: { label: string }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-zinc-900 text-zinc-300">
      <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-800/80">
        <FileIcon size={26} className="text-zinc-400" />
      </div>
      <span className="rounded-full border border-zinc-700 bg-zinc-950/80 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-zinc-300">
        {label}
      </span>
    </div>
  );
}

function getTypeThumbnailLabel(renderMode: FileRenderMode, filename: string) {
  if (renderMode === "docx") return "DOCX";
  if (renderMode === "spreadsheet") return getExtensionLabel(filename) || "XLSX";
  if (renderMode === "csv") return "CSV";
  if (renderMode === "text") return "TXT";
  return getExtensionLabel(filename) || "FILE";
}

function getExtensionLabel(filename: string) {
  const match = filename.match(/\.([A-Za-z0-9]{1,6})$/);
  return match?.[1]?.toUpperCase() ?? null;
}

function formatBytes(sizeBytes: number | null) {
  if (sizeBytes === null) return null;
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}
