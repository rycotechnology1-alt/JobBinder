import { NextRequest, NextResponse } from "next/server";
import { NoteType } from "@prisma/client";
import prisma from "@/lib/prisma";
import {
  accessErrorResponse,
  requireCompanyUser,
} from "@/lib/current-user";
import { buildAccessibleJobWhere } from "@/lib/account-access";

function parseReportDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    return null;
  }

  return date;
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireCompanyUser();
    const body = await req.json();
    const jobId = typeof body.jobId === "string" ? body.jobId.trim() : "";
    const reportDate = parseReportDate(body.reportDate);
    const workPerformed = typeof body.workPerformed === "string" ? body.workPerformed.trim() : "";
    const materialsUsed = typeof body.materialsUsed === "string" ? body.materialsUsed.trim() : "";
    const clientMutationId = typeof body.clientMutationId === "string" && body.clientMutationId.trim()
      ? body.clientMutationId.trim()
      : null;

    if (!jobId) {
      return NextResponse.json({ error: "Job is required." }, { status: 400 });
    }

    if (!reportDate) {
      return NextResponse.json({ error: "Report date must be YYYY-MM-DD." }, { status: 400 });
    }

    if (!workPerformed) {
      return NextResponse.json({ error: "Work performed is required." }, { status: 400 });
    }

    if (clientMutationId) {
      const existingReport = await prisma.note.findFirst({
        where: { companyId: user.companyId, clientMutationId },
      });

      if (existingReport) {
        return NextResponse.json(existingReport);
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

    const report = await prisma.note.create({
      data: {
        companyId: user.companyId,
        jobId: job.id,
        authorId: user.id,
        type: NoteType.DAILY_REPORT,
        content: workPerformed,
        category: null,
        statusTag: null,
        reportDate,
        materialsUsed: materialsUsed || null,
        ...(clientMutationId ? { clientMutationId } : {}),
      },
    });

    return NextResponse.json(report, { status: 201 });
  } catch (error) {
    const authResponse = accessErrorResponse(error);
    if (authResponse) return authResponse;

    console.error("Error creating daily report:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
