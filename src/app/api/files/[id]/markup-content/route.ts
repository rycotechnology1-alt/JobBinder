import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { accessErrorResponse, requireCompanyUser } from "@/lib/current-user";
import { downloadR2Object, uploadR2Object } from "@/lib/r2";
import { getFilePreviewInfo } from "@/lib/file-preview";
import { flattenMarkupToPdf } from "@/lib/markup/flatten";
import { serializeMark, type DbMarkRow } from "@/lib/markup/serialize";

function markupFilename(displayName: string | null, originalName: string) {
  const base = (displayName?.trim() || originalName).replace(/\.[A-Za-z0-9]{1,10}$/, "");
  return `${base} (marked up).pdf`;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireCompanyUser();
    const { id } = await params;

    const file = await prisma.file.findFirst({
      where: { id, companyId: user.companyId },
      select: { id: true, url: true, originalName: true, name: true, contentType: true },
    });
    if (!file) return NextResponse.json({ error: "File not found" }, { status: 404 });

    const filename = file.name || file.originalName;
    const { renderMode, contentType } = getFilePreviewInfo({ filename, contentType: file.contentType });
    if (renderMode !== "pdf" && renderMode !== "image") {
      return NextResponse.json({ error: "Markup is only available for PDFs and images." }, { status: 400 });
    }

    const cached = await prisma.fileMarkupExport.findUnique({ where: { fileId: file.id } });

    let pdfBytes: Uint8Array;
    if (cached && !cached.isStale && cached.storageKey) {
      pdfBytes = await downloadR2Object(cached.storageKey);
    } else {
      const rows = (await prisma.fileMarkupMark.findMany({
        where: { fileId: file.id, deletedAt: null },
        orderBy: { sequence: "asc" },
      })) as DbMarkRow[];
      const baseBytes = await downloadR2Object(file.url);
      pdfBytes = await flattenMarkupToPdf({
        mode: renderMode,
        baseBytes,
        imageContentType: contentType,
        marks: rows.map(serializeMark),
      });

      const storageKey = `${user.companyId}/${file.id}-markup.pdf`;
      await uploadR2Object(storageKey, pdfBytes, "application/pdf");
      await prisma.fileMarkupExport.upsert({
        where: { fileId: file.id },
        create: { fileId: file.id, storageKey, isStale: false, generatedAt: new Date() },
        update: { storageKey, isStale: false, generatedAt: new Date() },
      });
    }

    const isDownload = req.nextUrl.searchParams.get("download") === "1";
    const disposition = isDownload ? "attachment" : "inline";
    const downloadName = markupFilename(file.name, file.originalName).replaceAll('"', "");

    return new NextResponse(new Blob([new Uint8Array(pdfBytes)]), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": pdfBytes.byteLength.toString(),
        "Content-Disposition": `${disposition}; filename="${downloadName}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    const authResponse = accessErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("Error generating marked-up PDF:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
