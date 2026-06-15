import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  accessErrorResponse,
  requireFileAccess,
} from "@/lib/current-user";
import { downloadR2Object } from "@/lib/r2";
import { getDownloadFilename, getFilePreviewInfo } from "@/lib/file-preview";

function contentDisposition(filename: string, disposition: "inline" | "attachment") {
  const safeFilename = filename.replaceAll('"', "");
  return `${disposition}; filename="${safeFilename}"`;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { user } = await requireFileAccess(id);

    const file = await prisma.file.findFirst({
      where: { id, companyId: user.companyId },
      select: {
        id: true,
        url: true,
        originalName: true,
        name: true,
        contentType: true,
      },
    });

    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const filename = file.name || file.originalName;
    const downloadFilename = getDownloadFilename(file.name, file.originalName);
    const previewInfo = getFilePreviewInfo({ filename, contentType: file.contentType });
    const bytes = await downloadR2Object(file.url);
    const body = new Blob([new Uint8Array(bytes)]);
    const isDownload = req.nextUrl.searchParams.get("download") === "1";

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": previewInfo.contentType || "application/octet-stream",
        "Content-Length": bytes.byteLength.toString(),
        "Content-Disposition": contentDisposition(isDownload ? downloadFilename : filename, isDownload ? "attachment" : "inline"),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    const authResponse = accessErrorResponse(error);
    if (authResponse) return authResponse;

    console.error("Error streaming file content:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
