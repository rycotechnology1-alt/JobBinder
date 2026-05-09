import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get("companyId");

    if (!companyId) {
      return NextResponse.json({ error: "Missing companyId" }, { status: 400 });
    }

    // Fetch notes and files where jobId is null
    const [notes, files] = await Promise.all([
      prisma.note.findMany({
        where: { companyId, jobId: null },
        orderBy: { createdAt: "desc" },
        include: { author: { select: { name: true } } }
      }),
      prisma.file.findMany({
        where: { companyId, jobId: null },
        orderBy: { createdAt: "desc" },
        include: { uploader: { select: { name: true } } }
      })
    ]);

    return NextResponse.json({ notes, files });
  } catch (error) {
    console.error("Error fetching inbox:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
