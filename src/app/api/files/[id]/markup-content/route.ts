import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { accessErrorResponse, requireFileAccess } from "@/lib/current-user";
import { downloadR2Object } from "@/lib/r2";
import { ensureFileMarkupPdf, markupFilename } from "@/lib/markup/generate";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { user } = await requireFileAccess(id);

    const file = await prisma.file.findFirst({
      where: { id, companyId: user.companyId },
      select: { id: true, url: true, originalName: true, name: true, contentType: true },
    });
    if (!file) return NextResponse.json({ error: "File not found" }, { status: 404 });

    const result = await ensureFileMarkupPdf({ file, companyId: user.companyId });
    if (!result) {
      return NextResponse.json({ error: "Markup is only available for PDFs and images." }, { status: 400 });
    }

    const pdfBytes = await downloadR2Object(result.storageKey);

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
