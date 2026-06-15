import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  accessErrorResponse,
  requireJobAccess,
} from "@/lib/current-user";
import { downloadR2Object } from "@/lib/r2";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: exportId } = await params;

    // Find the export record
    const exportRecord = await prisma.export.findFirst({
      where: { id: exportId },
      include: { job: true },
    });

    if (!exportRecord) {
      return NextResponse.json({ error: "Export package not found" }, { status: 404 });
    }

    await requireJobAccess(exportRecord.jobId);

    if (exportRecord.status !== "READY" || !exportRecord.storageKey) {
      return NextResponse.json(
        { error: `Export package is not ready for download. Status: ${exportRecord.status}` },
        { status: 400 },
      );
    }

    // Download the ZIP from R2
    const zipBuffer = await downloadR2Object(exportRecord.storageKey);

    // Stream download back to client
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
    const authResponse = accessErrorResponse(error);
    if (authResponse) return authResponse;

    console.error("Error downloading export package:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
