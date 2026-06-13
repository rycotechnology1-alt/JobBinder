import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  accessErrorResponse,
  requireCompanyUser,
} from "@/lib/current-user";
import {
  getFilePreviewInfo,
  getOriginalContentUrl,
  getSpreadsheetPreviewUrl,
} from "@/lib/file-preview";

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
      previewArtifact: null,
    });
  } catch (error) {
    const authResponse = accessErrorResponse(error);
    if (authResponse) return authResponse;

    console.error("Error loading file preview metadata:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
