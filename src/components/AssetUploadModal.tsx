"use client";

import imageCompression from "browser-image-compression";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, FileScan, UploadCloud } from "lucide-react";
import { DEFAULT_ASSET_CATEGORY, getMimeTypeForFilename } from "@/lib/asset-categories";
import { queueOfflineFile } from "@/lib/offline-sync/queue";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { AssetCategorySelect } from "@/components/AssetCategorySelect";
import { ScanicScannerHost } from "@/features/uploads/scanner-scanic/ScanicScannerHost";
import { scanicScannerProvider } from "@/features/uploads/scanner-scanic/scanicProvider";
import type { ScanicDetectionMode } from "@/features/uploads/scanner-scanic/scanicTypes";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  jobId?: string;
  title?: string;
};

const ACCEPTED_UPLOAD_TYPES = [
  "image/*",
  "application/pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  "text/plain",
  "text/csv",
  ".txt",
  ".csv",
].join(",");

function isOffline() {
  return typeof navigator !== "undefined" && !navigator.onLine;
}

function isNetworkUploadError() {
  // Only fall back to the offline queue when the browser reports it is
  // actually offline. A `TypeError` from `fetch` can also mean CORS, TLS, or
  // a misconfigured server — those should surface to the user rather than
  // be silently queued for retry (which would just fail the same way).
  return isOffline();
}

async function uploadPreparedFile(input: {
  uploadUrl: string;
  objectKey: string;
  contentType: string;
  body: Blob;
}) {
  try {
    const r2Response = await fetch(input.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": input.contentType },
      body: input.body,
    });

    if (!r2Response.ok) {
      throw new Error("Cloudflare R2 upload failed.");
    }
  } catch (error) {
    if (!(error instanceof TypeError) || isOffline()) {
      throw error;
    }

    const relayResponse = await fetch("/api/files/upload-body", {
      method: "POST",
      headers: {
        "Content-Type": input.contentType,
        "X-Object-Key": input.objectKey,
      },
      body: input.body,
    });

    if (!relayResponse.ok) {
      let message = "Cloudflare R2 upload failed.";
      try {
        const payload = await relayResponse.json();
        if (typeof payload.error === "string") message = payload.error;
      } catch {
        // Keep the generic storage error when the relay cannot return JSON.
      }
      throw new Error(message);
    }
  }
}

type ScanUploadMetadata = {
  sourceType: "scan";
  scannedPageCount: number;
  createdFromMobileCamera: true;
  scannerProvider: "scanic";
  detectionMode?: ScanicDetectionMode;
};

export function AssetUploadModal({
  isOpen,
  onClose,
  jobId,
  title = "Upload File",
}: Props) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [selectedUploadFile, setSelectedUploadFile] = useState<File | null>(null);
  const [scanUploadMetadata, setScanUploadMetadata] = useState<ScanUploadMetadata | null>(null);

  function selectUploadFile(file: File | null) {
    setSelectedUploadFile(file);
    setScanUploadMetadata(null);
  }

  async function handleScanDocument() {
    setError(null);
    setStatus(null);

    try {
      const result = await scanicScannerProvider.openScanner({
        maxPages: 20,
        defaultFileName: "Scanned Document",
      });
      setSelectedUploadFile(result.file);
      setScanUploadMetadata({
        sourceType: "scan",
        scannedPageCount: result.pageCount,
        createdFromMobileCamera: true,
        scannerProvider: "scanic",
        detectionMode: result.metadata?.detectionMode,
      });
    } catch (scanError) {
      if (scanError instanceof Error && scanError.message === "Scanner canceled.") return;
      setError(scanError instanceof Error ? scanError.message : "Scanner is unavailable. Upload a file instead.");
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setStatus(null);

    const formData = new FormData(event.currentTarget);
    const selectedFile = selectedUploadFile ?? formData.get("file");
    const category = formData.get("category")?.toString() || DEFAULT_ASSET_CATEGORY;

    if (!(selectedFile instanceof File) || selectedFile.size === 0) {
      setError("Choose a photo or document to upload.");
      return;
    }

    const sourceFile = selectedFile;
    setIsUploading(true);
    let preparedFile: Blob = sourceFile;
    let preparedContentType = sourceFile.type || getMimeTypeForFilename(sourceFile.name) || "";

    try {
      if (sourceFile.type.startsWith("image/")) {
        setStatus("Compressing image...");
        preparedFile = await imageCompression(sourceFile, {
          maxSizeMB: 1.2,
          maxWidthOrHeight: 1920,
          useWebWorker: true,
        });
      }

      const contentType = preparedFile.type || sourceFile.type || getMimeTypeForFilename(sourceFile.name);
      if (!contentType) {
        throw new Error("Unsupported file type.");
      }
      const uploadContentType = contentType;
      preparedContentType = uploadContentType;

      async function queueUpload() {
        setStatus("Saving offline...");
        await queueOfflineFile({
          jobId,
          originalName: sourceFile.name,
          name: formData.get("name")?.toString() || "",
          contentType: uploadContentType,
          category,
          blob: preparedFile,
        });
      }

      if (isOffline()) {
        await queueUpload();
        formRef.current?.reset();
        setSelectedUploadFile(null);
        setScanUploadMetadata(null);
        onClose();
        return;
      }

      setStatus("Preparing secure upload...");
      const uploadUrlResponse = await fetch("/api/files/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: sourceFile.name,
          contentType: uploadContentType,
        }),
      });

      const uploadUrlPayload = await uploadUrlResponse.json();
      if (!uploadUrlResponse.ok) {
        throw new Error(uploadUrlPayload.error || "Could not create upload URL.");
      }

      setStatus("Uploading to secure storage...");
      await uploadPreparedFile({
        uploadUrl: uploadUrlPayload.uploadUrl,
        objectKey: uploadUrlPayload.objectKey,
        contentType: uploadContentType,
        body: preparedFile,
      });

      setStatus("Saving to job folder...");
      const fileResponse = await fetch("/api/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId,
          objectKey: uploadUrlPayload.objectKey,
          originalName: sourceFile.name,
          name: formData.get("name"),
          contentType: uploadContentType,
          sizeBytes: preparedFile.size,
          category,
          ...(scanUploadMetadata ?? {}),
        }),
      });

      const filePayload = await fileResponse.json();
      if (!fileResponse.ok) {
        throw new Error(filePayload.error || "Could not save file record.");
      }

      formRef.current?.reset();
      setSelectedUploadFile(null);
      setScanUploadMetadata(null);
      onClose();
      router.refresh();
    } catch (uploadError) {
      if (isNetworkUploadError()) {
        try {
          const fallbackContentType = preparedContentType || sourceFile.type || getMimeTypeForFilename(sourceFile.name);
          if (!fallbackContentType) throw new Error("Unsupported file type.");
          await queueOfflineFile({
            jobId,
            originalName: sourceFile.name,
            name: formData.get("name")?.toString() || "",
            contentType: fallbackContentType,
            category,
            blob: preparedFile,
          });
          formRef.current?.reset();
          setSelectedUploadFile(null);
          setScanUploadMetadata(null);
          onClose();
        } catch (queueError) {
          setError(queueError instanceof Error ? queueError.message : "Upload failed.");
        }
      } else {
        setError(uploadError instanceof Error ? uploadError.message : "Upload failed.");
      }
    } finally {
      setIsUploading(false);
      setStatus(null);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <ScanicScannerHost />
      <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-xl border border-dashed border-zinc-700 bg-black/20 p-5">
          <UploadCloud size={28} className="mb-3 text-brand-light" />
          <label htmlFor="upload-file" className="block text-sm font-medium text-zinc-300 mb-2">Photo or document</label>
          <input
            id="upload-file"
            name="file"
            type="file"
            accept={ACCEPTED_UPLOAD_TYPES}
            onChange={(event) => selectUploadFile(event.currentTarget.files?.[0] ?? null)}
            className="block w-full text-sm text-zinc-300 file:mr-4 file:rounded-lg file:border-0 file:bg-zinc-800 file:px-3 file:py-2 file:text-sm file:font-medium file:text-zinc-100 hover:file:bg-zinc-700"
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(event) => selectUploadFile(event.currentTarget.files?.[0] ?? null)}
          />
          <Button
            type="button"
            variant="secondary"
            onClick={() => cameraInputRef.current?.click()}
            className="md:hidden mt-3 w-full gap-2"
          >
            <Camera size={18} />
            Take Photo
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={handleScanDocument}
            className="md:hidden mt-3 w-full gap-2"
          >
            <FileScan size={18} />
            Scan Document
          </Button>
          {selectedUploadFile && (
            <p className="mt-2 text-xs text-brand-light">
              {scanUploadMetadata ? "Scanned" : "Selected"}: {selectedUploadFile.name}
            </p>
          )}
          <p className="mt-2 text-xs text-zinc-500">Images are compressed before upload. PDFs and office documents upload unchanged.</p>
        </div>

        <div>
          <label htmlFor="upload-name" className="block text-sm font-medium text-zinc-400 mb-1">
            Display Name
          </label>
          <Input id="upload-name" name="name" placeholder="Defaults to original filename" />
        </div>

        <div>
          <label htmlFor="upload-category" className="block text-sm font-medium text-zinc-400 mb-1">Category</label>
          <AssetCategorySelect id="upload-category" required />
        </div>

        {status && <p className="text-sm text-brand-light">{status}</p>}
        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="pt-4 flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isUploading}>Cancel</Button>
          <Button type="submit" disabled={isUploading}>
            {isUploading ? "Uploading..." : "Upload"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
