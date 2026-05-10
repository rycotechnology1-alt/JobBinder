import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { JobStatus } from "@prisma/client";
import {
  accessErrorResponse,
  requireCompanyUser,
} from "@/lib/current-user";
import {
  isValidJobStatus,
  isValidPriority,
  normalizeOptionalString,
  normalizeTargetCompletionDate,
} from "@/lib/job-management";

export async function GET(req: NextRequest) {
  try {
    const user = await requireCompanyUser();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") as JobStatus | null;
    const search = searchParams.get("search");

    const jobs = await prisma.job.findMany({
      where: {
        companyId: user.companyId,
        ...(status ? { status } : {}),
        ...(search
          ? {
              OR: [
                { title: { contains: search, mode: "insensitive" } },
                { customerName: { contains: search, mode: "insensitive" } },
                { jobNumber: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: [
        { priority: "desc" },
        { updatedAt: "desc" }
      ],
      select: {
        id: true,
        title: true,
        customerName: true,
        priority: true,
        status: true,
        targetCompletionDate: true,
        address: true,
        jobNumber: true,
        poNumber: true,
        contractNumber: true,
        createdAt: true,
        updatedAt: true
      }
    });

    return NextResponse.json(jobs);
  } catch (error) {
    const authResponse = accessErrorResponse(error);
    if (authResponse) return authResponse;

    console.error("Error fetching jobs:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireCompanyUser();
    const body = await req.json();
    const id = typeof body.id === "string" ? body.id : "";

    if (!id) {
      return NextResponse.json({ error: "Missing job id" }, { status: 400 });
    }

    const existingJob = await prisma.job.findFirst({
      where: { id, companyId: user.companyId },
      select: { id: true },
    });

    if (!existingJob) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const data: Record<string, unknown> = {};
    const optionalStringFields = [
      "jobNumber",
      "poNumber",
      "contractNumber",
      "customerName",
      "address",
      "contactName",
      "contactPhone",
      "contactEmail",
      "description",
    ] as const;

    if ("title" in body) {
      const title = normalizeOptionalString(body.title);
      if (!title) {
        return NextResponse.json({ error: "Title is required" }, { status: 400 });
      }
      data.title = title;
    }

    for (const field of optionalStringFields) {
      if (field in body) {
        data[field] = normalizeOptionalString(body[field]);
      }
    }

    if (typeof data.contactEmail === "string" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.contactEmail)) {
      return NextResponse.json({ error: "Invalid contact email" }, { status: 400 });
    }

    if ("status" in body) {
      if (!isValidJobStatus(body.status)) {
        return NextResponse.json({ error: "Invalid job status" }, { status: 400 });
      }
      data.status = body.status;
    }

    if ("priority" in body) {
      if (!isValidPriority(body.priority)) {
        return NextResponse.json({ error: "Invalid priority" }, { status: 400 });
      }
      data.priority = body.priority;
    }

    if ("targetCompletionDate" in body) {
      const targetCompletionDate = normalizeTargetCompletionDate(body.targetCompletionDate);
      if (targetCompletionDate === "INVALID_DATE") {
        return NextResponse.json({ error: "Invalid target completion date" }, { status: 400 });
      }
      data.targetCompletionDate = targetCompletionDate;
    }

    const job = await prisma.job.update({
      where: { id: existingJob.id },
      data,
    });

    return NextResponse.json(job);
  } catch (error) {
    const authResponse = accessErrorResponse(error);
    if (authResponse) return authResponse;

    console.error("Error updating job:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireCompanyUser();
    const body = await req.json();
    const { title, customerName, jobNumber, poNumber, address } = body;

    if (!title) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const job = await prisma.job.create({
      data: {
        companyId: user.companyId,
        title,
        createdById: user.id,
        customerName,
        jobNumber,
        poNumber,
        address,
      },
    });

    return NextResponse.json(job, { status: 201 });
  } catch (error) {
    const authResponse = accessErrorResponse(error);
    if (authResponse) return authResponse;

    console.error("Error creating job:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
