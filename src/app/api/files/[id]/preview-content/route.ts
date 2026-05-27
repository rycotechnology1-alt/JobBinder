import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  accessErrorResponse,
  requireCompanyUser,
} from "@/lib/current-user";
import { downloadR2Object } from "@/lib/r2";

function contentDisposition(filename: string) {
  const baseName = filename.replace(/\.[^.]+$/, "").replaceAll('"', "") || "preview";
  return `inline; filename="${baseName} preview.pdf"`;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireCompanyUser();
    const { id } = await params;

    const artifact = await prisma.filePreviewArtifact.findFirst({
      where: {
        fileId: id,
        kind: "OFFICE_PDF",
        status: "READY",
        file: { companyId: user.companyId },
      },
      include: { file: { select: { originalName: true, name: true } } },
    });

    if (!artifact?.storageKey) {
      return NextResponse.json({ error: "Preview not found" }, { status: 404 });
    }

    const bytes = await downloadR2Object(artifact.storageKey);
    const body = new Blob([new Uint8Array(bytes)]);
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": artifact.contentType,
        "Content-Length": bytes.byteLength.toString(),
        "Content-Disposition": contentDisposition(artifact.file.name || artifact.file.originalName),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    const authResponse = accessErrorResponse(error);
    if (authResponse) return authResponse;

    console.error("Error streaming file preview:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
