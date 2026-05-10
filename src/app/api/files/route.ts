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
    const validation = validateFileUploadInput(body);

    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
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
