import { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  Archive,
  Cloud,
  Download,
  Loader2,
  FileCheck,
  AlertCircle,
  RefreshCw,
  Link2,
  Copy,
  Check,
} from "lucide-react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  jobId: string;
  jobTitle: string;
}

type ExportState = "IDLE" | "PROCESSING" | "READY" | "FAILED";

type ExportRecord = {
  id: string;
  status: string;
  fileName: string | null;
  errorMessage: string | null;
  destination?: string | null;
  expiresAt?: string | null;
};

export function ExportModal({ isOpen, onClose, jobId, jobTitle }: Props) {
  const [exportState, setExportState] = useState<ExportState>("IDLE");
  const [activeExport, setActiveExport] = useState<ExportRecord | null>(null);
  const [destination, setDestination] = useState<"zip" | "share_link" | "google_drive" | "onedrive">("zip");
  const [expirationDays, setExpirationDays] = useState<7 | 30 | 90>(7);
  const [dateRangeType, setDateRangeType] = useState<"all" | "custom">("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  // Category filters
  const [categories, setCategories] = useState({
    photos: true,
    notes: true,
    punch_list: true,
    daily_reports: true,
    material_tickets: true,
    markups: true,
    other: true,
  });

  // Export options
  const [includeSummaryPdf, setIncludeSummaryPdf] = useState(true);
  const [includeItemIndexCsv, setIncludeItemIndexCsv] = useState(true);
  const [renameFilesForReadability, setRenameFilesForReadability] = useState(true);
  const [groupByCategory, setGroupByCategory] = useState(true);

  // Poll status interval
  useEffect(() => {
    if (exportState !== "PROCESSING" || !activeExport?.id) return;

    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      if (attempts > 135) {
        // ~337s window (135 × 2500ms) — comfortably beyond the 300s server budget.
        // The export may still finish server-side after this, so we frame it as
        // "still working" rather than a hard failure.
        setSubmitError(
          "This export is taking longer than expected and may still be finishing. Close this dialog and reopen it in a minute to grab the package.",
        );
        setExportState("FAILED");
        clearInterval(interval);
        return;
      }

      try {
        const res = await fetch(`/api/jobs/${jobId}/export?exportId=${activeExport.id}`);
        if (!res.ok) throw new Error("Could not check status");

        const data: ExportRecord = await res.json();
        if (data.status === "READY") {
          setActiveExport(data);
          setExportState("READY");
          clearInterval(interval);
        } else if (data.status === "FAILED") {
          setActiveExport(data);
          setSubmitError(data.errorMessage || "Package compilation failed on the server.");
          setExportState("FAILED");
          clearInterval(interval);
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [exportState, activeExport, jobId]);

  // Reset when modal opens or closes
  useEffect(() => {
    let isCancelled = false;

    if (isOpen) {
      queueMicrotask(() => {
        if (isCancelled) return;

        setExportState("IDLE");
        setActiveExport(null);
        setSubmitError(null);
        setLinkCopied(false);
      });
    }

    return () => {
      isCancelled = true;
    };
  }, [isOpen]);

  const toggleCategory = (key: keyof typeof categories) => {
    setCategories((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    // Validate that at least one category is selected
    const selectedCats = Object.entries(categories)
      .filter((entry) => entry[1])
      .map(([key]) => key);

    if (selectedCats.length === 0) {
      setSubmitError("Please select at least one data category to export.");
      return;
    }

    if (dateRangeType === "custom" && (!startDate || !endDate)) {
      setSubmitError("Please specify both a start date and an end date for custom ranges.");
      return;
    }

    setExportState("PROCESSING");

    const payload = {
      destination,
      expirationDays: destination === "share_link" ? expirationDays : undefined,
      dateRange:
        dateRangeType === "custom"
          ? {
              start: startDate,
              end: endDate,
            }
          : undefined,
      categories: selectedCats,
      includeSummaryPdf,
      includeItemIndexCsv,
      includeTextWorkbook: true,
      renameFilesForReadability,
      groupByCategory,
    };

    try {
      const res = await fetch(`/api/jobs/${jobId}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errPayload = await res.json();
        throw new Error(errPayload.error || "Could not launch export job.");
      }

      const data: ExportRecord = await res.json();
      setActiveExport(data);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "An error occurred.");
      setExportState("FAILED");
    }
  };

  const handleDownload = () => {
    if (!activeExport?.id) return;
    window.location.href = `/api/exports/${activeExport.id}/download`;
  };

  const shareUrl = activeExport?.id
    ? (typeof window !== "undefined" ? window.location.origin : "") + `/share/${activeExport.id}`
    : "";

  const handleCopyLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (err) {
      console.error("Could not copy link to clipboard:", err);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Export Job Package" className="max-w-2xl">
      {exportState === "IDLE" && (
        <form onSubmit={handleGenerate} className="space-y-6">
          {/* Destination Selector */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-zinc-400">Export Destination</label>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <button
                type="button"
                onClick={() => setDestination("zip")}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs gap-2 transition-all ${
                  destination === "zip"
                    ? "border-brand bg-brand/5 text-brand"
                    : "border-zinc-800 bg-zinc-900/30 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                }`}
              >
                <Archive size={20} />
                Download ZIP
              </button>
              <button
                type="button"
                onClick={() => setDestination("share_link")}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs gap-2 transition-all ${
                  destination === "share_link"
                    ? "border-brand bg-brand/5 text-brand"
                    : "border-zinc-800 bg-zinc-900/30 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                }`}
              >
                <Link2 size={20} />
                Share Link
              </button>
              <button
                type="button"
                disabled
                className="flex flex-col items-center justify-center p-3 rounded-xl border border-zinc-800 bg-zinc-950/20 text-zinc-600 text-xs gap-2 cursor-not-allowed opacity-50"
              >
                <Cloud size={20} />
                Google Drive
                <span className="text-[10px] text-zinc-500 font-normal">Coming soon</span>
              </button>
              <button
                type="button"
                disabled
                className="flex flex-col items-center justify-center p-3 rounded-xl border border-zinc-800 bg-zinc-950/20 text-zinc-600 text-xs gap-2 cursor-not-allowed opacity-50"
              >
                <Cloud size={20} />
                OneDrive
                <span className="text-[10px] text-zinc-500 font-normal">Coming soon</span>
              </button>
            </div>

            {destination === "share_link" && (
              <div className="rounded-xl border border-brand/20 bg-brand/5 p-4 animate-in fade-in slide-in-from-top-2 duration-200 space-y-3">
                <div className="flex items-start gap-3">
                  <Link2 size={16} className="text-brand mt-0.5 shrink-0" />
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-zinc-200">Public Share Link</p>
                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                      A secure, unguessable link will be generated. Anyone with the link can download the ZIP package
                      without signing in to JobBinder.
                    </p>
                  </div>
                </div>
                <div>
                  <label htmlFor="expirationDays" className="block text-xs font-semibold text-zinc-500 mb-1.5">
                    Link Expiration
                  </label>
                  <select
                    id="expirationDays"
                    value={expirationDays}
                    onChange={(e) => setExpirationDays(Number(e.target.value) as 7 | 30 | 90)}
                    className="w-full h-11 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 text-sm text-zinc-100 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                  >
                    <option value={7}>7 Days</option>
                    <option value={30}>30 Days</option>
                    <option value={90}>90 Days</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Date Range Selection */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-zinc-400">Date Range</label>
            <div className="grid grid-cols-2 gap-3">
              <label
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium cursor-pointer transition-all ${
                  dateRangeType === "all"
                    ? "border-brand bg-brand/5 text-brand"
                    : "border-zinc-800 bg-zinc-900/30 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                }`}
              >
                <input
                  type="radio"
                  name="dateRangeType"
                  value="all"
                  checked={dateRangeType === "all"}
                  onChange={() => setDateRangeType("all")}
                  className="h-4 w-4 border-zinc-700 bg-zinc-900 text-brand focus:ring-brand"
                />
                All Time
              </label>
              <label
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium cursor-pointer transition-all ${
                  dateRangeType === "custom"
                    ? "border-brand bg-brand/5 text-brand"
                    : "border-zinc-800 bg-zinc-900/30 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                }`}
              >
                <input
                  type="radio"
                  name="dateRangeType"
                  value="custom"
                  checked={dateRangeType === "custom"}
                  onChange={() => setDateRangeType("custom")}
                  className="h-4 w-4 border-zinc-700 bg-zinc-900 text-brand focus:ring-brand"
                />
                Custom Range
              </label>
            </div>

            {dateRangeType === "custom" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 animate-in fade-in duration-200">
                <div>
                  <label htmlFor="startDate" className="block text-xs font-semibold text-zinc-500 mb-1">
                    Start Date
                  </label>
                  <Input
                    id="startDate"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="endDate" className="block text-xs font-semibold text-zinc-500 mb-1">
                    End Date
                  </label>
                  <Input
                    id="endDate"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Categories Multi-Select Checklist */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-zinc-400">Include Categories</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {Object.entries(categories).map(([key, checked]) => {
                const labelMap: Record<string, string> = {
                  photos: "Photos",
                  notes: "Field Notes",
                  punch_list: "Punch List",
                  daily_reports: "Daily Reports",
                  material_tickets: "Material Tickets",
                  markups: "Markups",
                  other: "Other Items",
                };
                return (
                  <label
                    key={key}
                    className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-xs font-medium cursor-pointer select-none transition-all ${
                      checked
                        ? "border-brand/40 bg-brand/5 text-zinc-100 font-semibold"
                        : "border-zinc-800/80 bg-zinc-900/10 text-zinc-500 hover:border-zinc-800 hover:text-zinc-400"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleCategory(key as keyof typeof categories)}
                      className="h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-brand focus:ring-brand"
                    />
                    {labelMap[key] || key}
                  </label>
                );
              })}
            </div>
          </div>

          {/* Detailed Export Layout Options */}
          <div className="rounded-xl border border-zinc-800 bg-black/20 p-4 space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500">Document & Formatting Options</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="flex items-start gap-3 text-xs text-zinc-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeSummaryPdf}
                  onChange={(e) => setIncludeSummaryPdf(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-brand focus:ring-brand"
                />
                <div>
                  <span className="font-semibold block text-zinc-200">Include Job Summary PDF</span>
                  <span className="text-zinc-500">Creates a premium 00 - Job Summary.pdf handoff document.</span>
                </div>
              </label>

              <label className="flex items-start gap-3 text-xs text-zinc-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeItemIndexCsv}
                  onChange={(e) => setIncludeItemIndexCsv(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-brand focus:ring-brand"
                />
                <div>
                  <span className="font-semibold block text-zinc-200">Include Item Index CSV</span>
                  <span className="text-zinc-500">Creates 00 - Item Index.csv to list, sort, and track files.</span>
                </div>
              </label>

              <label className="flex items-start gap-3 text-xs text-zinc-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={renameFilesForReadability}
                  onChange={(e) => setRenameFilesForReadability(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-brand focus:ring-brand"
                />
                <div>
                  <span className="font-semibold block text-zinc-200">Rename Files for Readability</span>
                  <span className="text-zinc-500">Formats names cleanly (e.g. YYYY-MM-DD - [Category] - [Title]).</span>
                </div>
              </label>

              <label className="flex items-start gap-3 text-xs text-zinc-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={groupByCategory}
                  onChange={(e) => setGroupByCategory(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-brand focus:ring-brand"
                />
                <div>
                  <span className="font-semibold block text-zinc-200">Group Files by Category Folder</span>
                  <span className="text-zinc-500">Arranges items into labeled subdirectories (e.g. 01 - Photos).</span>
                </div>
              </label>
            </div>
          </div>

          {submitError && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 flex items-start gap-3 text-sm text-red-400 animate-shake">
              <AlertCircle className="shrink-0 mt-0.5" size={16} />
              <p>{submitError}</p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-zinc-800/50">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">
              Generate Export
            </Button>
          </div>
        </form>
      )}

      {exportState === "PROCESSING" && (
        <div className="flex flex-col items-center justify-center py-12 space-y-6 text-center">
          <div className="relative flex items-center justify-center">
            <div className="absolute h-16 w-16 rounded-full border-4 border-zinc-800 border-t-brand animate-spin" />
            <Loader2 className="text-brand animate-pulse" size={32} />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-zinc-50">Preparing Export Package</h3>
            <p className="text-sm text-zinc-400 max-w-sm">
              We are compiling and categorizing your job items, fetching storage files, and building the ZIP package.
              This may take a moment depending on folder size.
            </p>
          </div>
        </div>
      )}

      {exportState === "READY" && (
        <div className="flex flex-col items-center justify-center py-10 space-y-6 text-center animate-in fade-in duration-300">
          <div className="h-16 w-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <FileCheck size={36} />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-zinc-50">
              {destination === "share_link" ? "Share Link Ready!" : "Export Package Ready!"}
            </h3>
            <p className="text-sm text-zinc-400 max-w-md">
              {destination === "share_link" ? (
                <>
                  The public share link for <span className="text-zinc-200 font-semibold">{jobTitle}</span> is ready.
                  Anyone with the link can download the package until it expires.
                </>
              ) : (
                <>
                  The project handoff package for <span className="text-zinc-200 font-semibold">{jobTitle}</span> was
                  successfully generated and is ready to save.
                </>
              )}
            </p>
            {activeExport?.fileName && (
              <span className="inline-block mt-2 font-mono text-xs px-2.5 py-1 bg-zinc-900 border border-zinc-800 rounded text-zinc-400">
                {activeExport.fileName}
              </span>
            )}
          </div>

          {destination === "share_link" ? (
            <div className="w-full max-w-md space-y-4">
              <div className="flex items-stretch gap-2">
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  onClick={(e) => e.currentTarget.select()}
                  className="flex-1 h-11 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 text-xs font-mono text-zinc-200 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                />
                <Button
                  onClick={handleCopyLink}
                  className={`gap-2 font-semibold shrink-0 ${
                    linkCopied ? "bg-emerald-600 hover:bg-emerald-500" : ""
                  }`}
                >
                  {linkCopied ? (
                    <>
                      <Check size={16} /> Copied
                    </>
                  ) : (
                    <>
                      <Copy size={16} /> Copy Link
                    </>
                  )}
                </Button>
              </div>
              {activeExport?.expiresAt && (
                <p className="text-[11px] text-zinc-500">
                  Expires {new Date(activeExport.expiresAt).toLocaleString()}
                </p>
              )}
              <div className="flex justify-center pt-2 border-t border-zinc-800/50">
                <Button variant="secondary" onClick={() => setExportState("IDLE")} className="gap-2 mt-4">
                  <RefreshCw size={16} /> Export Again
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-3 pt-6 w-full max-w-md justify-center border-t border-zinc-800/50">
              <Button variant="secondary" onClick={() => setExportState("IDLE")} className="gap-2">
                <RefreshCw size={16} /> Export Again
              </Button>
              <Button onClick={handleDownload} className="gap-2 font-semibold bg-emerald-600 hover:bg-emerald-500 shadow-emerald-950/20">
                <Download size={16} /> Download ZIP
              </Button>
            </div>
          )}
        </div>
      )}

      {exportState === "FAILED" && (
        <div className="flex flex-col items-center justify-center py-10 space-y-6 text-center animate-in fade-in duration-300">
          <div className="h-16 w-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
            <AlertCircle size={36} />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-zinc-50">Export Generation Failed</h3>
            <p className="text-sm text-red-400 max-w-md">
              {submitError || "An unexpected error occurred during zip construction."}
            </p>
          </div>

          <div className="flex gap-3 pt-6 w-full max-w-xs justify-center border-t border-zinc-800/50">
            <Button variant="secondary" onClick={onClose} className="w-full">
              Close
            </Button>
            <Button onClick={() => setExportState("IDLE")} className="w-full">
              Try Again
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
