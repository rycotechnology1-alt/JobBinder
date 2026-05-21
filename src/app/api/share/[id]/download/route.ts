import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { downloadR2Object } from "@/lib/r2";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: exportId } = await params;

    const exportRecord = await prisma.export.findFirst({
      where: { id: exportId },
    });

    if (!exportRecord) {
      return NextResponse.json({ error: "Share link not found" }, { status: 404 });
    }

    if (exportRecord.destination !== "SHARE_LINK") {
      return NextResponse.json({ error: "This export is not shared publicly" }, { status: 403 });
    }

    if (exportRecord.status !== "READY" || !exportRecord.storageKey) {
      return NextResponse.json(
        { error: `Share package is not ready. Status: ${exportRecord.status}` },
        { status: 400 },
      );
    }

    if (exportRecord.expiresAt && exportRecord.expiresAt.getTime() < Date.now()) {
      return NextResponse.json({ error: "Share link has expired" }, { status: 410 });
    }

    const zipBuffer = await downloadR2Object(exportRecord.storageKey);

    const headers = new Headers();
    headers.set("Content-Type", "application/zip");
    headers.set(
      "Content-Disposition",
      `attachment; filename="${exportRecord.fileName || "Job-Package-Export.zip"}"`,
    );

    return new NextResponse(new Uint8Array(zipBuffer), {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error("Error downloading shared export package:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
