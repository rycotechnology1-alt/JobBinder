import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  accessErrorResponse,
  requireCompanyUser,
} from "@/lib/current-user";
import { validateFileUploadInput } from "@/lib/asset-categories";
import { normalizeFileDisplayName } from "@/lib/job-folder";
import { isCompanyScopedObjectKey } from "@/lib/r2";

export async function POST(req: NextRequest) {
  try {
    const user = await requireCompanyUser();
    const body = await req.json();
    const { jobId, createdAt } = body;
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

    if (jobId) {
      const job = await prisma.job.findFirst({
        where: { id: jobId, companyId: user.companyId },
        select: { id: true },
      });

      if (!job) {
        return NextResponse.json({ error: "Job not found" }, { status: 404 });
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
        ...(clientMutationId ? { clientMutationId } : {}),
        ...(createdAt ? { createdAt: new Date(createdAt) } : {}),
      },
    });

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
      where: { id: jobId, companyId: user.companyId },
      select: { id: true },
    });

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const file = await prisma.file.findFirst({
      where: { id, companyId: user.companyId },
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
