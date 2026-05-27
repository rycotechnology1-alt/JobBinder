import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  accessErrorResponse,
  requireCompanyUser,
} from "@/lib/current-user";
import {
  getFilePreviewInfo,
  getOriginalContentUrl,
  getPreviewContentUrl,
  getSpreadsheetPreviewUrl,
  isOfficePreviewType,
} from "@/lib/file-preview";

const OFFICE_PREVIEW_KIND = "OFFICE_PDF";
const OFFICE_PREVIEW_CONTENT_TYPE = "application/pdf";

function serializeArtifact(artifact: {
  id: string;
  kind: string;
  status: string;
  contentType: string;
  storageKey: string | null;
  lastError: string | null;
  updatedAt?: Date;
} | null, fileId: string) {
  if (!artifact) return null;
  return {
    id: artifact.id,
    kind: artifact.kind,
    status: artifact.status,
    contentType: artifact.contentType,
    previewUrl: artifact.status === "READY" && artifact.storageKey ? getPreviewContentUrl(fileId) : null,
    lastError: artifact.lastError,
    updatedAt: artifact.updatedAt?.toISOString?.() ?? null,
  };
}

async function loadFileForPreview(id: string, companyId: string) {
  return prisma.file.findFirst({
    where: { id, companyId },
    select: {
      id: true,
      type: true,
      originalName: true,
      name: true,
      contentType: true,
      sizeBytes: true,
      category: true,
    },
  });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireCompanyUser();
    const { id } = await params;
    const file = await loadFileForPreview(id, user.companyId);

    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const filename = file.name || file.originalName;
    const previewInfo = getFilePreviewInfo({ filename, contentType: file.contentType });
    const artifact = previewInfo.renderMode === "office"
      ? await prisma.filePreviewArtifact.findFirst({
          where: { fileId: file.id, kind: OFFICE_PREVIEW_KIND },
        })
      : null;

    return NextResponse.json({
      file: {
        id: file.id,
        type: file.type,
        filename,
        originalName: file.originalName,
        category: file.category,
        sizeBytes: file.sizeBytes,
        contentType: previewInfo.contentType,
        renderMode: previewInfo.renderMode,
        originalUrl: getOriginalContentUrl(file.id),
        downloadUrl: getOriginalContentUrl(file.id, { download: true }),
        spreadsheetPreviewUrl: previewInfo.renderMode === "spreadsheet" ? getSpreadsheetPreviewUrl(file.id) : null,
      },
      previewArtifact: serializeArtifact(artifact, file.id),
    });
  } catch (error) {
    const authResponse = accessErrorResponse(error);
    if (authResponse) return authResponse;

    console.error("Error loading file preview metadata:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireCompanyUser();
    const { id } = await params;
    const file = await loadFileForPreview(id, user.companyId);

    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const filename = file.name || file.originalName;
    const previewInfo = getFilePreviewInfo({ filename, contentType: file.contentType });
    if (!isOfficePreviewType(previewInfo.contentType)) {
      return NextResponse.json({ error: "This file type does not need a generated preview." }, { status: 400 });
    }

    const artifact = await prisma.filePreviewArtifact.upsert({
      where: { fileId_kind: { fileId: file.id, kind: OFFICE_PREVIEW_KIND } },
      create: {
        fileId: file.id,
        kind: OFFICE_PREVIEW_KIND,
        status: "QUEUED",
        contentType: OFFICE_PREVIEW_CONTENT_TYPE,
        requestedById: user.id,
      },
      update: {
        status: "QUEUED",
        storageKey: null,
        lastError: null,
        contentType: OFFICE_PREVIEW_CONTENT_TYPE,
        requestedById: user.id,
      },
    });

    return NextResponse.json({
      previewArtifact: serializeArtifact(artifact, file.id),
    }, { status: 202 });
  } catch (error) {
    const authResponse = accessErrorResponse(error);
    if (authResponse) return authResponse;

    console.error("Error queueing file preview:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
