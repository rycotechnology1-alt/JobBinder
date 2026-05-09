import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { JobStatus } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get("companyId");
    const status = searchParams.get("status") as JobStatus | null;
    const search = searchParams.get("search");

    if (!companyId) {
      return NextResponse.json({ error: "Missing companyId" }, { status: 400 });
    }

    const jobs = await prisma.job.findMany({
      where: {
        companyId,
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
    console.error("Error fetching jobs:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { companyId, title, createdById, customerName, jobNumber, poNumber, address } = body;

    if (!companyId || !title || !createdById) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const job = await prisma.job.create({
      data: {
        companyId,
        title,
        createdById,
        customerName,
        jobNumber,
        poNumber,
        address,
      },
    });

    return NextResponse.json(job, { status: 201 });
  } catch (error) {
    console.error("Error creating job:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
