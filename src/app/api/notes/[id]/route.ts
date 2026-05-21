import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  accessErrorResponse,
  requireAdminUser,
} from "@/lib/current-user";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAdminUser();
    const { id } = await params;

    const note = await prisma.note.findFirst({
      where: { id, companyId: user.companyId, jobId: { not: null } },
      select: { id: true },
    });

    if (!note) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    await prisma.note.delete({ where: { id: note.id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    const authResponse = accessErrorResponse(error);
    if (authResponse) return authResponse;

    console.error("Error deleting note:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
