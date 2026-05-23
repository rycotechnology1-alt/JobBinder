"use client";

import { Camera, Check, FilePlus2, X } from "lucide-react";
import { Button } from "@/components/ui/Button";

type Props = {
  pageCount: number;
  maxPages: number;
  isCameraActive: boolean;
  isBusy: boolean;
  canFinish: boolean;
  canAddPage?: boolean;
  onCapture: () => void;
  onAddPage: () => void;
  onFinish: () => void;
  onCancel: () => void;
};

export function ScanicCaptureControls({
  pageCount,
  maxPages,
  isCameraActive,
  isBusy,
  canFinish,
  canAddPage = true,
  onCapture,
  onAddPage,
  onFinish,
  onCancel,
}: Props) {
  return (
    <div className="flex shrink-0 items-center justify-between gap-2 border-t border-zinc-800 bg-zinc-950/95 p-3">
      <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={isBusy} aria-label="Cancel scan">
        <X size={18} />
      </Button>

      <div className="flex items-center gap-2">
        {!isCameraActive && canAddPage && pageCount < maxPages && (
          <Button type="button" variant="secondary" onClick={onAddPage} disabled={isBusy} className="gap-2">
            <FilePlus2 size={18} />
            Add Page
          </Button>
        )}

        {isCameraActive ? (
          <Button
            type="button"
            onClick={onCapture}
            disabled={isBusy || pageCount >= maxPages}
            className="h-14 w-14 rounded-full p-0"
            aria-label="Capture page"
          >
            <Camera size={24} />
          </Button>
        ) : (
          <Button type="button" onClick={onFinish} disabled={isBusy || !canFinish} className="gap-2">
            <Check size={18} />
            Finish
          </Button>
        )}
      </div>
    </div>
  );
}
