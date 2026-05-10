import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { NoteType } from "@prisma/client";
import {
  accessErrorResponse,
  requireCompanyUser,
} from "@/lib/current-user";
import { normalizeAssetCategory } from "@/lib/asset-categories";

export async function POST(req: NextRequest) {
  try {
    const user = await requireCompanyUser();
    const body = await req.json();
    const { jobId, type, content, category, statusTag, createdAt } = body;

    if (!content || !type) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (jobId) {
      const job = await prisma.job.findFirst({
        where: { id: jobId, companyId: user.companyId },
        select: { id: true },
      });

      if (!job) {
        return NextResponse.json({ error: "Job not found" }, { status: 404 });
      }
    }

    const note = await prisma.note.create({
      data: {
        companyId: user.companyId,
        jobId: jobId || null, // If null, it goes to Unsorted Inbox
        authorId: user.id,
        type: type as NoteType,
        content,
        category: normalizeAssetCategory(category),
        statusTag,
        // Allow client to pass historical capture time (offline support)
        ...(createdAt ? { createdAt: new Date(createdAt) } : {})
      },
    });

    return NextResponse.json(note, { status: 201 });
  } catch (error) {
    const authResponse = accessErrorResponse(error);
    if (authResponse) return authResponse;

    console.error("Error creating note:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
