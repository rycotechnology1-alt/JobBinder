import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  accessErrorResponse,
  requireCompanyUser,
} from "@/lib/current-user";

export async function GET() {
  try {
    const user = await requireCompanyUser();

    // Fetch notes and files where jobId is null
    const [notes, files] = await Promise.all([
      prisma.note.findMany({
        where: { companyId: user.companyId, jobId: null },
        orderBy: { createdAt: "desc" },
        include: { author: { select: { name: true } } }
      }),
      prisma.file.findMany({
        where: { companyId: user.companyId, jobId: null },
        orderBy: { createdAt: "desc" },
        include: { uploader: { select: { name: true } } }
      })
    ]);

    return NextResponse.json({ notes, files });
  } catch (error) {
    const authResponse = accessErrorResponse(error);
    if (authResponse) return authResponse;

    console.error("Error fetching inbox:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
