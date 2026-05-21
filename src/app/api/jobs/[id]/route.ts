import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  accessErrorResponse,
  requireAdminUser,
} from "@/lib/current-user";
import { deleteR2Object } from "@/lib/r2";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAdminUser();
    const { id } = await params;

    const job = await prisma.job.findFirst({
      where: { id, companyId: user.companyId },
      select: {
        id: true,
        files: { select: { id: true, url: true } },
        exports: { select: { id: true, storageKey: true } },
      },
    });

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    await prisma.$transaction([
      prisma.file.deleteMany({ where: { jobId: job.id, companyId: user.companyId } }),
      prisma.note.deleteMany({ where: { jobId: job.id, companyId: user.companyId } }),
      prisma.task.deleteMany({ where: { jobId: job.id, companyId: user.companyId } }),
      prisma.export.deleteMany({ where: { jobId: job.id } }),
      prisma.job.delete({ where: { id: job.id } }),
    ]);

    const exportStorageKeys = job.exports
      .map((exportRecord) => exportRecord.storageKey)
      .filter((storageKey): storageKey is string => Boolean(storageKey));
    const cleanupResults = await Promise.allSettled([
      ...job.files.map((file) => deleteR2Object(file.url)),
      ...exportStorageKeys.map((storageKey) => deleteR2Object(storageKey)),
    ]);
    cleanupResults.forEach((result) => {
      if (result.status === "rejected") {
        console.warn("Job file storage cleanup failed:", result.reason);
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const authResponse = accessErrorResponse(error);
    if (authResponse) return authResponse;

    console.error("Error deleting job:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
