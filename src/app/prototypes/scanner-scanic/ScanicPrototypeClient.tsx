"use client";

import { useState } from "react";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ScanicScannerHost } from "@/features/uploads/scanner-scanic/ScanicScannerHost";
import { scanicScannerProvider } from "@/features/uploads/scanner-scanic/scanicProvider";
import type { ScannerResult } from "@/features/uploads/scanner-scanic/scanicTypes";

export function ScanicPrototypeClient() {
  const [result, setResult] = useState<ScannerResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function openScanner() {
    setError(null);
    try {
      const scannerResult = await scanicScannerProvider.openScanner({
        maxPages: 20,
        defaultFileName: "Scanned Document",
      });
      setResult(scannerResult);
    } catch (openError) {
      if (openError instanceof Error && openError.message === "Scanner canceled.") return;
      setError(openError instanceof Error ? openError.message : "Scanner unavailable.");
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col justify-center gap-5">
      <ScanicScannerHost />
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-5">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-300">
            <FileText size={22} />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-zinc-50">Scanic Scanner Prototype</h1>
            <p className="text-sm text-zinc-500">Open this route from a mobile browser on HTTPS or localhost.</p>
          </div>
        </div>
        <Button type="button" onClick={openScanner} className="w-full gap-2">
          <FileText size={18} />
          Scan Document
        </Button>
        {result && (
          <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-300">
            <p className="font-medium text-zinc-100">{result.file.name}</p>
            <p>{result.pageCount} pages, {(result.file.size / 1024 / 1024).toFixed(2)} MB</p>
            <p>Detection: {result.metadata?.detectionMode ?? "unknown"}</p>
          </div>
        )}
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      </div>
    </div>
  );
}

