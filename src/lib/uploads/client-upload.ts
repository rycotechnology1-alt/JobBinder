"use client";

import imageCompression from "browser-image-compression";
import { getMimeTypeForFilename, validateSupportedUploadType } from "@/lib/asset-categories";

export const ACCEPTED_UPLOAD_TYPES = [
  "image/*",
  "application/pdf",
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

export type PreparedClientUpload = {
  sourceFile: File;
  body: Blob;
  contentType: string;
};

type UploadFileRecordInput = {
  jobId?: string;
  noteId?: string;
  taskId?: string;
  markupMarkId?: string;
  originalName: string;
  name?: string;
  category: string;
  prepared: PreparedClientUpload;
  metadata?: Record<string, unknown>;
  onStatus?: (status: string) => void;
};

export function isOffline() {
  return typeof navigator !== "undefined" && !navigator.onLine;
}

export function isNetworkUploadError() {
  return isOffline();
}

export async function prepareClientUploadFile(
  sourceFile: File,
  onStatus?: (status: string) => void,
): Promise<PreparedClientUpload> {
  const initialContentType = sourceFile.type || getMimeTypeForFilename(sourceFile.name) || "";
  const initialValidation = validateSupportedUploadType({
    filename: sourceFile.name,
    contentType: initialContentType,
  });
  if (!initialValidation.ok) throw new Error(initialValidation.error);

  let body: Blob = sourceFile;

  if (initialValidation.type === "PHOTO" || sourceFile.type.startsWith("image/")) {
    onStatus?.("Compressing image...");
    body = await imageCompression(sourceFile, {
      maxSizeMB: 1.2,
      maxWidthOrHeight: 1920,
      useWebWorker: true,
    });
  }

  const contentType = body.type || sourceFile.type || getMimeTypeForFilename(sourceFile.name);
  const uploadTypeValidation = validateSupportedUploadType({
    filename: sourceFile.name,
    contentType,
  });
  if (!uploadTypeValidation.ok) throw new Error(uploadTypeValidation.error);

  return {
    sourceFile,
    body,
    contentType: uploadTypeValidation.contentType,
  };
}

export async function uploadPreparedFileToStorage(input: {
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

export async function uploadFileRecord(input: UploadFileRecordInput) {
  input.onStatus?.("Preparing secure upload...");
  const uploadUrlResponse = await fetch("/api/files/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename: input.originalName,
      contentType: input.prepared.contentType,
    }),
  });

  const uploadUrlPayload = await uploadUrlResponse.json();
  if (!uploadUrlResponse.ok) {
    throw new Error(uploadUrlPayload.error || "Could not create upload URL.");
  }

  input.onStatus?.("Uploading to secure storage...");
  await uploadPreparedFileToStorage({
    uploadUrl: uploadUrlPayload.uploadUrl,
    objectKey: uploadUrlPayload.objectKey,
    contentType: input.prepared.contentType,
    body: input.prepared.body,
  });

  input.onStatus?.("Saving to job folder...");
  const fileResponse = await fetch("/api/files", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jobId: input.jobId,
      noteId: input.noteId,
      taskId: input.taskId,
      markupMarkId: input.markupMarkId,
      objectKey: uploadUrlPayload.objectKey,
      originalName: input.originalName,
      name: input.name ?? "",
      contentType: input.prepared.contentType,
      sizeBytes: input.prepared.body.size,
      category: input.category,
      ...(input.metadata ?? {}),
    }),
  });

  const filePayload = await fileResponse.json();
  if (!fileResponse.ok) {
    throw new Error(filePayload.error || "Could not save file record.");
  }

  return filePayload;
}
