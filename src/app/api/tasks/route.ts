import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { TaskType, TaskStatus } from "@prisma/client";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { companyId, jobId, title, description, type, dueDate, createdById, assignedToId } = body;

    if (!companyId || !jobId || !title || !createdById) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const task = await prisma.task.create({
      data: {
        companyId,
        jobId,
        title,
        description,
        type: type as TaskType || "TASK",
        dueDate: dueDate ? new Date(dueDate) : null,
        createdById,
        assignedToId,
      },
    });

    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    console.error("Error creating task:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, status } = body;

    if (!id || !status) {
      return NextResponse.json({ error: "Missing id or status" }, { status: 400 });
    }

    const task = await prisma.task.update({
      where: { id },
      data: { status: status as TaskStatus },
    });

    return NextResponse.json(task);
  } catch (error) {
    console.error("Error updating task:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
