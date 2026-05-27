"use client";

import { useState } from "react";
import { Eye, FileIcon, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { DeleteConfirmationButton } from "@/components/DeleteConfirmationButton";
import { FileViewerOverlay } from "@/components/FileViewerOverlay";
import { getOriginalContentUrl } from "@/lib/file-preview";

type Props = {
  fileId: string;
  type: "PHOTO" | "DOCUMENT";
  filename: string;
  category?: string | null;
  canDelete?: boolean;
  onDelete?: () => void;
};

export function FilePreview({ fileId, type, filename, category, canDelete = false, onDelete }: Props) {
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const openFile = () => setIsViewerOpen(true);

  if (type === "PHOTO") {
    return (
      <>
        <div className="rounded-xl border border-zinc-800 bg-black/20 overflow-hidden">
          <button type="button" onClick={openFile} className="relative block aspect-video w-full bg-zinc-900">
            <span className="sr-only">View {filename}</span>
            <ImageIcon size={28} className="absolute left-1/2 top-1/2 text-zinc-600 -translate-x-1/2 -translate-y-1/2" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={getOriginalContentUrl(fileId)}
              alt={filename}
              className="absolute inset-0 h-full w-full object-cover"
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
            />
          </button>
          <div className="p-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-zinc-200 truncate">{filename}</p>
              <div className="mt-1 flex items-center gap-2">
                <Badge variant="brand">Photo</Badge>
                {category && <Badge>{category}</Badge>}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={openFile} aria-label={`View ${filename}`}>
                <Eye size={16} />
              </Button>
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
        </div>
        <FileViewerOverlay fileId={fileId} isOpen={isViewerOpen} onClose={() => setIsViewerOpen(false)} initialFilename={filename} />
      </>
    );
  }

  return (
    <>
      <div className="rounded-xl border border-zinc-800 bg-black/20 p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0">
            <FileIcon size={20} className="text-zinc-400" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-zinc-200 truncate">{filename}</p>
            <div className="mt-1 flex items-center gap-2">
              <Badge>Document</Badge>
              {category && <Badge variant="brand">{category}</Badge>}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={openFile} className="gap-2">
            <Eye size={16} />
            View
          </Button>
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
