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
    const clientMutationId = typeof body.clientMutationId === "string" && body.clientMutationId.trim()
      ? body.clientMutationId.trim()
      : null;

    if (!content || !type) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (clientMutationId) {
      const existingNote = await prisma.note.findFirst({
        where: { companyId: user.companyId, clientMutationId },
      });

      if (existingNote) {
        return NextResponse.json(existingNote);
      }
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
        ...(clientMutationId ? { clientMutationId } : {}),
        // Allow client to pass historical capture time (offline support)
        ...(createdAt ? { createdAt: new Date(createdAt) } : {}),
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

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireCompanyUser();
    const body = await req.json();
    const id = typeof body.id === "string" ? body.id : "";
    const jobId = typeof body.jobId === "string" ? body.jobId : "";

    if (!id || !jobId) {
      return NextResponse.json({ error: "Missing note id or job id" }, { status: 400 });
    }

    const job = await prisma.job.findFirst({
      where: { id: jobId, companyId: user.companyId },
      select: { id: true },
    });

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const note = await prisma.note.findFirst({
      where: { id, companyId: user.companyId },
      select: { id: true },
    });

    if (!note) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    const updatedNote = await prisma.note.update({
      where: { id: note.id },
      data: { jobId: job.id },
    });

    return NextResponse.json(updatedNote);
  } catch (error) {
    const authResponse = accessErrorResponse(error);
    if (authResponse) return authResponse;

    console.error("Error updating note:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
