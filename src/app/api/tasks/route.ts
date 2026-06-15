import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { TaskType, TaskStatus } from "@prisma/client";
import {
  accessErrorResponse,
  requireCompanyUser,
} from "@/lib/current-user";
import { buildAccessibleJobWhere } from "@/lib/account-access";
import { isValidTaskStatus, isValidTaskType } from "@/lib/job-folder";

export async function POST(req: NextRequest) {
  try {
    const user = await requireCompanyUser();
    const body = await req.json();
    const { title, description, type, dueDate, assignedToId, createdAt } = body;
    let jobId = typeof body.jobId === "string" && body.jobId.trim() ? body.jobId.trim() : "";
    const sourceMarkupMarkId = typeof body.sourceMarkupMarkId === "string" && body.sourceMarkupMarkId.trim()
      ? body.sourceMarkupMarkId.trim()
      : null;
    const normalizedTitle = typeof title === "string" ? title.trim() : "";
    const normalizedType = type === undefined || type === null || type === "" ? "TASK" : type;
    const clientMutationId = typeof body.clientMutationId === "string" && body.clientMutationId.trim()
      ? body.clientMutationId.trim()
      : null;

    if (sourceMarkupMarkId) {
      const existingSourceTask = await prisma.task.findFirst({
        where: { companyId: user.companyId, sourceMarkupMarkId },
      });

      if (existingSourceTask) {
        return NextResponse.json(existingSourceTask);
      }

      const sourceMark = await prisma.fileMarkupMark.findFirst({
        where: { id: sourceMarkupMarkId, companyId: user.companyId, kind: "PIN", deletedAt: null },
        select: { id: true, file: { select: { id: true, jobId: true } } },
      });

      if (!sourceMark) {
        return NextResponse.json({ error: "Pinned comment not found" }, { status: 404 });
      }

      if (!sourceMark.file.jobId) {
        return NextResponse.json({ error: "Pinned comment is not on a job" }, { status: 400 });
      }

      if (jobId && jobId !== sourceMark.file.jobId) {
        return NextResponse.json({ error: "Pinned comment is not on this job" }, { status: 400 });
      }

      jobId = sourceMark.file.jobId;
    }

    if (!jobId || !normalizedTitle) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (!isValidTaskType(normalizedType)) {
      return NextResponse.json({ error: "Invalid task type" }, { status: 400 });
    }

    if (clientMutationId) {
      const existingTask = await prisma.task.findFirst({
        where: { companyId: user.companyId, clientMutationId },
      });

      if (existingTask) {
        return NextResponse.json(existingTask);
      }
    }

    const job = await prisma.job.findFirst({
      where: {
        id: jobId,
        ...buildAccessibleJobWhere({
          companyId: user.companyId,
          membershipId: user.membershipId,
          role: user.role,
          crewIds: user.crewIds,
          orgUnitIds: user.orgUnitIds,
        }),
      },
      select: { id: true },
    });

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    if (assignedToId) {
      const assignee = await prisma.companyMembership.findFirst({
        where: { userId: assignedToId, companyId: user.companyId, status: "ACTIVE" },
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
        title: normalizedTitle,
        description: typeof description === "string" && description.trim() ? description.trim() : null,
        type: normalizedType as TaskType,
        dueDate: dueDate ? new Date(dueDate) : null,
        createdById: user.id,
        assignedToId,
        ...(sourceMarkupMarkId ? { sourceMarkupMarkId } : {}),
        ...(clientMutationId ? { clientMutationId } : {}),
        ...(createdAt ? { createdAt: new Date(createdAt) } : {}),
      },
    });

    if (sourceMarkupMarkId) {
      await prisma.file.updateMany({
        where: { companyId: user.companyId, markupMarkId: sourceMarkupMarkId },
        data: { taskId: task.id },
      });
    }

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

    if (!isValidTaskStatus(status)) {
      return NextResponse.json({ error: "Invalid task status" }, { status: 400 });
    }

    const existingTask = await prisma.task.findFirst({
      where: { id, companyId: user.companyId },
      select: { id: true, jobId: true },
    });

    if (!existingTask) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const job = await prisma.job.findFirst({
      where: {
        id: existingTask.jobId,
        ...buildAccessibleJobWhere({
          companyId: user.companyId,
          membershipId: user.membershipId,
          role: user.role,
          crewIds: user.crewIds,
          orgUnitIds: user.orgUnitIds,
        }),
      },
      select: { id: true },
    });

    if (!job) {
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
