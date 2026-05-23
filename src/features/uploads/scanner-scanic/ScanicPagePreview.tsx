"use client";

/* eslint-disable @next/next/no-img-element */

import { RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { ScanicPage } from "./scanicTypes";

type Props = {
  page: ScanicPage;
  pageNumber: number;
  onDelete: () => void;
  onRetake: () => void;
};

export function ScanicPagePreview({ page, pageNumber, onDelete, onRetake }: Props) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
        <img
          src={page.objectUrl}
          alt={`Scanned page ${pageNumber}`}
          className="h-full max-h-[42vh] w-full object-contain"
        />
      </div>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-zinc-100">Page {pageNumber}</p>
          <p className="text-xs text-zinc-500">
            {page.detectionMode === "fallback" ? "Full-image fallback" : "Perspective corrected"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onRetake} aria-label="Retake page">
            <RotateCcw size={16} />
          </Button>
          <Button type="button" variant="danger" size="sm" onClick={onDelete} aria-label="Delete page">
            <Trash2 size={16} />
          </Button>
        </div>
      </div>
    </div>
  );
}
