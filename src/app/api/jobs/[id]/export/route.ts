import { format } from "date-fns";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  accessErrorResponse,
  requireCompanyUser,
} from "@/lib/current-user";
import { ExportJobPackageService, ExportOptions } from "@/lib/services/ExportJobPackageService";
import { uploadR2Object } from "@/lib/r2";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireCompanyUser();
    const { id: jobId } = await params;
    const body = await req.json();

    const job = await prisma.job.findFirst({
      where: { id: jobId, companyId: user.companyId },
    });

    if (!job) {
      return NextResponse.json({ error: "Job folder not found" }, { status: 404 });
    }

    // Default filters
    const options: ExportOptions = {
      destination: body.destination || "zip",
      dateRange: body.dateRange,
      categories: body.categories || ["photos", "notes", "punch_list", "progress_updates", "daily_reports", "material_tickets", "other"],
      includeSummaryPdf: body.includeSummaryPdf !== false,
      includeItemIndexCsv: body.includeItemIndexCsv !== false,
      includeTextWorkbook: body.includeTextWorkbook !== false,
      renameFilesForReadability: body.renameFilesForReadability !== false,
      groupByCategory: body.groupByCategory !== false,
    };

    const destinationKey = options.destination.toUpperCase();

    // Compute expiration for share links (defaults to 7 days; allowed: 7, 30, 90)
    let expiresAt: Date | null = null;
    if (destinationKey === "SHARE_LINK") {
      const requested = Number(body.expirationDays);
      const days = [7, 30, 90].includes(requested) ? requested : 7;
      expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    }

    // Create a new Export record with status PROCESSING
    const exportRecord = await prisma.export.create({
      data: {
        jobId,
        createdById: user.id,
        destination: destinationKey,
        status: "PROCESSING",
        optionsJson: JSON.stringify(options),
        expiresAt,
      },
    });

    // Start background package compilation process asynchronously
    (async () => {
      try {
        // 1. Build manifest
        const manifest = await ExportJobPackageService.buildManifest(
          jobId,
          options,
          user.id,
          user.companyId,
        );

        // 2. Generate ZIP
        const zipBuffer = await ExportJobPackageService.generateZip(manifest, options);

        // 3. Upload ZIP to R2
        const storageKey = `${user.companyId}/exports/${exportRecord.id}.zip`;
        await uploadR2Object(storageKey, zipBuffer, "application/zip");

        // 4. Update database record
        const dateStr = format(new Date(), "yyyy-MM-dd");
        const cleanTitle = job.title.replace(/[\\/:*?"<>|%#]/g, "-").trim();
        const fileName = `${cleanTitle} - Export - ${dateStr}.zip`;

        await prisma.export.update({
          where: { id: exportRecord.id },
          data: {
            status: "READY",
            storageKey,
            fileName,
            completedAt: new Date(),
          },
        });
      } catch (err) {
        console.error(`Background export compilation failed for ID ${exportRecord.id}:`, err);
        await prisma.export.update({
          where: { id: exportRecord.id },
          data: {
            status: "FAILED",
            completedAt: new Date(),
            errorMessage: err instanceof Error ? err.message : "Unknown error during package creation",
          },
        });
      }
    })();

    return NextResponse.json(exportRecord, { status: 201 });
  } catch (error) {
    const authResponse = accessErrorResponse(error);
    if (authResponse) return authResponse;

    console.error("Error creating export job:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireCompanyUser();
    const { id: jobId } = await params;
    const { searchParams } = new URL(req.url);
    const exportId = searchParams.get("exportId");

    const job = await prisma.job.findFirst({
      where: { id: jobId, companyId: user.companyId },
    });

    if (!job) {
      return NextResponse.json({ error: "Job folder not found" }, { status: 404 });
    }

    let exportRecord = null;
    if (exportId) {
      exportRecord = await prisma.export.findFirst({
        where: { id: exportId, jobId, createdById: user.id },
      });
    } else {
      exportRecord = await prisma.export.findFirst({
        where: { jobId, createdById: user.id },
        orderBy: { createdAt: "desc" },
      });
    }

    if (!exportRecord) {
      return NextResponse.json({ status: "NONE" });
    }

    return NextResponse.json(exportRecord);
  } catch (error) {
    const authResponse = accessErrorResponse(error);
    if (authResponse) return authResponse;

    console.error("Error fetching export status:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
