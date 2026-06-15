import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  accessErrorResponse,
  requireFileAccess,
} from "@/lib/current-user";
import { createSignedAccessUrl } from "@/lib/r2";

export async function GET(
  _req: NextRequest,
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
      },
    });

    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const accessUrl = await createSignedAccessUrl({
      objectKey: file.url,
      filename: file.name || file.originalName,
    });

    return NextResponse.json({ accessUrl });
  } catch (error) {
    const authResponse = accessErrorResponse(error);
    if (authResponse) return authResponse;

    console.error("Error generating file access URL:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
