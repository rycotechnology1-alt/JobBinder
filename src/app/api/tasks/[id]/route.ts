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

    const task = await prisma.task.findFirst({
      where: { id, companyId: user.companyId },
      select: { id: true },
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    await prisma.task.delete({ where: { id: task.id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    const authResponse = accessErrorResponse(error);
    if (authResponse) return authResponse;

    console.error("Error deleting task:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
