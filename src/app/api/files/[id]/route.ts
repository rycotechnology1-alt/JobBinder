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

    const file = await prisma.file.findFirst({
      where: { id, companyId: user.companyId, jobId: { not: null } },
      select: { id: true, url: true },
    });

    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    await prisma.file.delete({ where: { id: file.id } });

    try {
      await deleteR2Object(file.url);
    } catch (cleanupError) {
      console.warn("File storage cleanup failed:", cleanupError);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const authResponse = accessErrorResponse(error);
    if (authResponse) return authResponse;

    console.error("Error deleting file:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
