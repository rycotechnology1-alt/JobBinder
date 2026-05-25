"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FileText, X } from "lucide-react";
import { ScanicCameraView } from "./ScanicCameraView";
import { ScanicCaptureControls } from "./ScanicCaptureControls";
import { ScanicCornerReview } from "./ScanicCornerReview";
import { ScanicPagePreview } from "./ScanicPagePreview";
import { ScanicPageStrip } from "./ScanicPageStrip";
import { createPdfFileFromScannedPages } from "./scanicPdfGeneration";
import type { ScanicCapture, ScanicDetectionMode, ScanicPage, ScannerResult } from "./scanicTypes";

type Props = {
  isOpen: boolean;
  maxPages?: number;
  defaultFileName?: string;
  onComplete: (result: ScannerResult) => void;
  onCancel: () => void;
};

function createPage(capture: ScanicCapture): ScanicPage {
  const blob = capture.blob;
  return {
    id: globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2),
    blob,
    objectUrl: URL.createObjectURL(blob),
    width: capture.width,
    height: capture.height,
    detectionMode: capture.detectionMode,
    corners: capture.corners,
    confidence: capture.confidence,
  };
}

function getSessionDetectionMode(pages: ScanicPage[]): ScanicDetectionMode {
  if (pages.some((page) => page.detectionMode === "live")) return "live";
  if (pages.some((page) => page.detectionMode === "capture")) return "capture";
  return "fallback";
}

export function ScanicScannerModal({
  isOpen,
  maxPages = 20,
  defaultFileName = "Scanned Document",
  onComplete,
  onCancel,
}: Props) {
  const [pages, setPages] = useState<ScanicPage[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(true);
  const [captureRequestId, setCaptureRequestId] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isFinishing, setIsFinishing] = useState(false);
  const [isCameraUnavailable, setIsCameraUnavailable] = useState(false);
  const [pendingCapture, setPendingCapture] = useState<ScanicCapture | null>(null);
  const [pendingCaptureUrl, setPendingCaptureUrl] = useState<string | null>(null);
  const pagesRef = useRef<ScanicPage[]>([]);

  const selectedPage = useMemo(
    () => pages.find((page) => page.id === selectedPageId) ?? pages.at(-1) ?? null,
    [pages, selectedPageId],
  );

  useEffect(() => {
    if (!isOpen) return;

    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  useEffect(() => {
    pagesRef.current = pages;
  }, [pages]);

  useEffect(() => () => {
    pagesRef.current.forEach((page) => URL.revokeObjectURL(page.objectUrl));
  }, []);

  useEffect(() => () => {
    if (pendingCaptureUrl) URL.revokeObjectURL(pendingCaptureUrl);
  }, [pendingCaptureUrl]);

  const handleCapture = useCallback((capture: ScanicCapture) => {
    setPendingCaptureUrl((currentUrl) => {
      if (currentUrl) URL.revokeObjectURL(currentUrl);
      return URL.createObjectURL(capture.blob);
    });
    setPendingCapture(capture);
    setIsCameraActive(false);
    setIsCameraUnavailable(false);
  }, []);

  const handleAcceptReviewedCapture = useCallback((capture: ScanicCapture) => {
    const page = createPage(capture);
    setPages((currentPages) => {
      const nextPages = [...currentPages, page].slice(0, maxPages);
      return nextPages;
    });
    setPendingCapture(null);
    setPendingCaptureUrl((currentUrl) => {
      if (currentUrl) URL.revokeObjectURL(currentUrl);
      return null;
    });
    setIsCameraUnavailable(false);
    setSelectedPageId(page.id);
    setIsCameraActive(false);
  }, [maxPages]);

  const handleRetakePendingCapture = useCallback(() => {
    setPendingCapture(null);
    setPendingCaptureUrl((currentUrl) => {
      if (currentUrl) URL.revokeObjectURL(currentUrl);
      return null;
    });
    setIsCameraActive(true);
  }, []);

  const handleDeleteSelected = useCallback(() => {
    if (!selectedPage) return;
    URL.revokeObjectURL(selectedPage.objectUrl);
    setPages((currentPages) => currentPages.filter((page) => page.id !== selectedPage.id));
    setSelectedPageId((currentPageId) => {
      if (currentPageId !== selectedPage.id) return currentPageId;
      const remainingPages = pages.filter((page) => page.id !== selectedPage.id);
      return remainingPages.at(-1)?.id ?? null;
    });
    if (pages.length <= 1) setIsCameraActive(true);
  }, [pages, selectedPage]);

  const handleRetakeSelected = useCallback(() => {
    if (selectedPage) {
      URL.revokeObjectURL(selectedPage.objectUrl);
      setPages((currentPages) => currentPages.filter((page) => page.id !== selectedPage.id));
      setSelectedPageId(null);
    }
    setPendingCapture(null);
    setPendingCaptureUrl((currentUrl) => {
      if (currentUrl) URL.revokeObjectURL(currentUrl);
      return null;
    });
    setIsCameraActive(true);
  }, [selectedPage]);

  const handleScannerError = useCallback((message: string) => {
    setError(message);
    if (pagesRef.current.length === 0) {
      setIsCameraUnavailable(true);
      setIsCameraActive(false);
    }
  }, []);

  const handleFinish = useCallback(async () => {
    setError(null);
    setIsFinishing(true);
    try {
      const file = await createPdfFileFromScannedPages(pages, { defaultFileName });
      const detectionMode = getSessionDetectionMode(pages);
      onComplete({
        file,
        pageCount: pages.length,
        source: "scan",
        metadata: {
          scannerProvider: "scanic",
          detectionMode,
        },
      });
    } catch (finishError) {
      setError(finishError instanceof Error ? finishError.message : "Could not create the scanned PDF.");
    } finally {
      setIsFinishing(false);
    }
  }, [defaultFileName, onComplete, pages]);

  if (!isOpen || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[120] flex bg-zinc-950 text-zinc-50">
      <div className="flex h-dvh w-full flex-col">
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-800 bg-zinc-950/95 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-300">
              <FileText size={20} />
            </div>
            <div>
              <h2 className="text-base font-semibold">Scan Document</h2>
              <p className="text-xs text-zinc-500">{pages.length} of {maxPages} pages</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full p-2 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-50"
            aria-label="Close scanner"
          >
            <X size={20} />
          </button>
        </div>

        {isCameraActive ? (
          <ScanicCameraView
            isActive={isOpen && isCameraActive}
            captureRequestId={captureRequestId}
            onCapture={handleCapture}
            onError={handleScannerError}
          />
        ) : pendingCapture && pendingCaptureUrl ? (
          <ScanicCornerReview
            key={pendingCaptureUrl}
            capture={pendingCapture}
            objectUrl={pendingCaptureUrl}
            onAccept={handleAcceptReviewedCapture}
            onRetake={handleRetakePendingCapture}
            onError={setError}
          />
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
            {selectedPage ? (
              <ScanicPagePreview
                page={selectedPage}
                pageNumber={pages.findIndex((page) => page.id === selectedPage.id) + 1}
                onDelete={handleDeleteSelected}
                onRetake={handleRetakeSelected}
              />
            ) : (
              <div className="flex min-h-[320px] flex-1 items-center justify-center rounded-lg border border-dashed border-zinc-800 text-sm text-zinc-500">
                Capture a page to preview it here.
              </div>
            )}
            <ScanicPageStrip pages={pages} selectedPageId={selectedPage?.id ?? null} onSelectPage={setSelectedPageId} />
          </div>
        )}

        {error && (
          <div className="border-t border-red-500/20 bg-red-500/10 px-4 py-2 text-sm text-red-200">
            {error}
          </div>
        )}

        {!pendingCapture && (
          <ScanicCaptureControls
            pageCount={pages.length}
            maxPages={maxPages}
            isCameraActive={isCameraActive}
            isBusy={isFinishing}
            canFinish={pages.length > 0}
            canAddPage={!isCameraUnavailable}
            onCapture={() => setCaptureRequestId((requestId) => requestId + 1)}
            onAddPage={() => {
              setError(null);
              setIsCameraActive(true);
            }}
            onFinish={handleFinish}
            onCancel={onCancel}
          />
        )}
      </div>
    </div>,
    document.body,
  );
}
