import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { JobStatus } from "@prisma/client";
import {
  accessErrorResponse,
  requireCompanyUser,
} from "@/lib/current-user";

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
