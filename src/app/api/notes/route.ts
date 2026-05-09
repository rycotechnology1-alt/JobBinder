import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { NoteType } from "@prisma/client";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { companyId, jobId, authorId, type, content, category, statusTag, createdAt } = body;

    if (!companyId || !authorId || !content || !type) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const note = await prisma.note.create({
      data: {
        companyId,
        jobId: jobId || null, // If null, it goes to Unsorted Inbox
        authorId,
        type: type as NoteType,
        content,
        category,
        statusTag,
        // Allow client to pass historical capture time (offline support)
        ...(createdAt ? { createdAt: new Date(createdAt) } : {})
      },
    });

    return NextResponse.json(note, { status: 201 });
  } catch (error) {
    console.error("Error creating note:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
