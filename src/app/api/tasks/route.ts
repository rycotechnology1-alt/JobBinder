import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { TaskType, TaskStatus } from "@prisma/client";
import {
  accessErrorResponse,
  requireCompanyUser,
} from "@/lib/current-user";

export async function POST(req: NextRequest) {
  try {
    const user = await requireCompanyUser();
    const body = await req.json();
    const { jobId, title, description, type, dueDate, assignedToId } = body;

    if (!jobId || !title) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const job = await prisma.job.findFirst({
      where: { id: jobId, companyId: user.companyId },
      select: { id: true },
    });

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    if (assignedToId) {
      const assignee = await prisma.user.findFirst({
        where: { id: assignedToId, companyId: user.companyId },
        select: { id: true },
      });

      if (!assignee) {
        return NextResponse.json({ error: "Assignee not found" }, { status: 404 });
      }
    }

    const task = await prisma.task.create({
      data: {
        companyId: user.companyId,
        jobId,
        title,
        description,
        type: type as TaskType || "TASK",
        dueDate: dueDate ? new Date(dueDate) : null,
        createdById: user.id,
        assignedToId,
      },
    });

    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    const authResponse = accessErrorResponse(error);
    if (authResponse) return authResponse;

    console.error("Error creating task:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireCompanyUser();
    const body = await req.json();
    const { id, status } = body;

    if (!id || !status) {
      return NextResponse.json({ error: "Missing id or status" }, { status: 400 });
    }

    const existingTask = await prisma.task.findFirst({
      where: { id, companyId: user.companyId },
      select: { id: true },
    });

    if (!existingTask) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const task = await prisma.task.update({
      where: { id: existingTask.id },
      data: { status: status as TaskStatus },
    });

    return NextResponse.json(task);
  } catch (error) {
    const authResponse = accessErrorResponse(error);
    if (authResponse) return authResponse;

    console.error("Error updating task:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
