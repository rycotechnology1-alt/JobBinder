import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  accessErrorResponse,
  requireCompanyUser,
} from "@/lib/current-user";
import { buildAccessibleJobWhere, isAccountManagerRole } from "@/lib/account-access";
import { validateFileUploadInput } from "@/lib/asset-categories";
import { normalizeFileDisplayName } from "@/lib/job-folder";
import { isCompanyScopedObjectKey } from "@/lib/r2";

export async function POST(req: NextRequest) {
  try {
    const user = await requireCompanyUser();
    const body = await req.json();
    const { createdAt } = body;
    let jobId = typeof body.jobId === "string" && body.jobId.trim()
      ? body.jobId.trim()
      : "";
    const noteId = typeof body.noteId === "string" && body.noteId.trim()
      ? body.noteId.trim()
      : null;
    const taskId = typeof body.taskId === "string" && body.taskId.trim()
      ? body.taskId.trim()
      : null;
    const markupMarkId = typeof body.markupMarkId === "string" && body.markupMarkId.trim()
      ? body.markupMarkId.trim()
      : null;
    const clientMutationId = typeof body.clientMutationId === "string" && body.clientMutationId.trim()
      ? body.clientMutationId.trim()
      : null;
    const validation = validateFileUploadInput(body);

    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    if (clientMutationId) {
      const existingFile = await prisma.file.findFirst({
        where: { companyId: user.companyId, clientMutationId },
      });

      if (existingFile) {
        return NextResponse.json(existingFile);
      }
    }

    if (!isCompanyScopedObjectKey(validation.value.objectKey, user.companyId)) {
      return NextResponse.json({ error: "Object key is outside company storage" }, { status: 403 });
    }

    if (taskId) {
      const task = await prisma.task.findFirst({
        where: {
          id: taskId,
          companyId: user.companyId,
          ...(jobId ? { jobId } : {}),
        },
        select: { id: true, jobId: true },
      });

      if (!task) {
        return NextResponse.json({ error: "Task not found" }, { status: 404 });
      }

      jobId = task.jobId;
    }

    let sourceMarkupFileId: string | null = null;
    if (markupMarkId) {
      if (validation.value.type !== "PHOTO") {
        return NextResponse.json({ error: "Pinned comment attachments must be images." }, { status: 400 });
      }

      const mark = await prisma.fileMarkupMark.findFirst({
        where: { id: markupMarkId, companyId: user.companyId, deletedAt: null },
        select: { id: true, kind: true, file: { select: { id: true, jobId: true } } },
      });

      if (!mark || mark.kind !== "PIN") {
        return NextResponse.json({ error: "Pinned comment not found" }, { status: 404 });
      }

      if (!mark.file.jobId) {
        return NextResponse.json({ error: "Pinned comment is not on a job" }, { status: 400 });
      }

      if (jobId && jobId !== mark.file.jobId) {
        return NextResponse.json({ error: "Pinned comment is not on this job" }, { status: 400 });
      }

      jobId = mark.file.jobId;
      sourceMarkupFileId = mark.file.id;
    }

    if (jobId) {
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
    }

    if (noteId) {
      if (!jobId) {
        return NextResponse.json({ error: "Job is required for daily report attachments" }, { status: 400 });
      }

      const note = await prisma.note.findFirst({
        where: { id: noteId, companyId: user.companyId, jobId },
        select: { id: true, jobId: true },
      });

      if (!note) {
        return NextResponse.json({ error: "Daily report not found" }, { status: 404 });
      }
    }

    const file = await prisma.file.create({
      data: {
        companyId: user.companyId,
        jobId: jobId || null,
        uploaderId: user.id,
        type: validation.value.type,
        url: validation.value.objectKey,
        originalName: validation.value.originalName,
        name: normalizeFileDisplayName(body.name),
        category: validation.value.category,
        contentType: validation.value.contentType,
        sizeBytes: validation.value.sizeBytes,
        ...(noteId ? { noteId } : {}),
        ...(taskId ? { taskId } : {}),
        ...(markupMarkId ? { markupMarkId } : {}),
        ...(clientMutationId ? { clientMutationId } : {}),
        ...(createdAt ? { createdAt: new Date(createdAt) } : {}),
      },
    });

    if (sourceMarkupFileId) {
      await prisma.fileMarkupExport.upsert({
        where: { fileId: sourceMarkupFileId },
        create: { fileId: sourceMarkupFileId, isStale: true },
        update: { isStale: true },
      });
    }

    return NextResponse.json(file, { status: 201 });
  } catch (error) {
    const authResponse = accessErrorResponse(error);
    if (authResponse) return authResponse;

    console.error("Error creating file:", error);
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
      return NextResponse.json({ error: "Missing file id or job id" }, { status: 400 });
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

    const file = await prisma.file.findFirst({
      where: {
        id,
        companyId: user.companyId,
        ...(isAccountManagerRole(user.role) ? {} : { uploaderId: user.id }),
      },
      select: { id: true },
    });

    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const updatedFile = await prisma.file.update({
      where: { id: file.id },
      data: { jobId: job.id },
    });

    return NextResponse.json(updatedFile);
  } catch (error) {
    const authResponse = accessErrorResponse(error);
    if (authResponse) return authResponse;

    console.error("Error updating file:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
