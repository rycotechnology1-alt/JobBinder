"use client";

import { useEffect, useState } from "react";
import { ExternalLink, FileIcon, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { DeleteConfirmationButton } from "@/components/DeleteConfirmationButton";

type Props = {
  fileId: string;
  type: "PHOTO" | "DOCUMENT";
  filename: string;
  category?: string | null;
  canDelete?: boolean;
  onDelete?: () => void;
};

export function FilePreview({ fileId, type, filename, category, canDelete = false, onDelete }: Props) {
  const [accessUrl, setAccessUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadAccessUrl() {
      try {
        const response = await fetch(`/api/files/${fileId}/access-url`);
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error || "Could not load file.");
        }

        if (isMounted) setAccessUrl(payload.accessUrl);
      } catch (loadError) {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : "Could not load file.");
        }
      }
    }

    loadAccessUrl();

    return () => {
      isMounted = false;
    };
  }, [fileId]);

  const openFile = () => {
    if (accessUrl) window.open(accessUrl, "_blank", "noopener,noreferrer");
  };

  if (type === "PHOTO") {
    return (
      <div className="rounded-xl border border-zinc-800 bg-black/20 overflow-hidden">
        <div className="aspect-video bg-zinc-900 flex items-center justify-center">
          {accessUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={accessUrl} alt={filename} className="h-full w-full object-cover" />
          ) : (
            <ImageIcon size={28} className="text-zinc-600" />
          )}
        </div>
        <div className="p-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-zinc-200 truncate">{filename}</p>
            <div className="mt-1 flex items-center gap-2">
              <Badge variant="brand">Photo</Badge>
              {category && <Badge>{category}</Badge>}
            </div>
            {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={openFile} disabled={!accessUrl} aria-label={`Open ${filename}`}>
              <ExternalLink size={16} />
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
    );
  }

  return (
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
          {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={openFile} disabled={!accessUrl} className="gap-2">
          <ExternalLink size={16} />
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
  );
}
