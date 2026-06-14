"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, FileScan, UploadCloud } from "lucide-react";
import { DEFAULT_ASSET_CATEGORY } from "@/lib/asset-categories";
import { queueOfflineFile } from "@/lib/offline-sync/queue";
import {
  ACCEPTED_UPLOAD_TYPES,
  isNetworkUploadError,
  isOffline,
  prepareClientUploadFile,
  uploadFileRecord,
} from "@/lib/uploads/client-upload";
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

  function resetAndClose(refresh = false) {
    formRef.current?.reset();
    setSelectedUploadFile(null);
    setScanUploadMetadata(null);
    onClose();
    if (refresh) router.refresh();
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

    try {
      const prepared = await prepareClientUploadFile(sourceFile, setStatus);

      async function queueUpload() {
        setStatus("Saving offline...");
        await queueOfflineFile({
          jobId,
          originalName: sourceFile.name,
          name: formData.get("name")?.toString() || "",
          contentType: prepared.contentType,
          category,
          blob: prepared.body,
        });
      }

      if (isOffline()) {
        await queueUpload();
        resetAndClose();
        return;
      }

      await uploadFileRecord({
        jobId,
        originalName: sourceFile.name,
        name: formData.get("name")?.toString() || "",
        category,
        prepared,
        metadata: scanUploadMetadata ?? undefined,
        onStatus: setStatus,
      });

      resetAndClose(true);
    } catch (uploadError) {
      if (isNetworkUploadError()) {
        try {
          const prepared = await prepareClientUploadFile(sourceFile, setStatus);
          await queueOfflineFile({
            jobId,
            originalName: sourceFile.name,
            name: formData.get("name")?.toString() || "",
            contentType: prepared.contentType,
            category,
            blob: prepared.body,
          });
          resetAndClose();
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
          <p className="mt-2 text-xs text-zinc-500">Images are compressed before upload. PDFs and supported documents upload unchanged.</p>
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
