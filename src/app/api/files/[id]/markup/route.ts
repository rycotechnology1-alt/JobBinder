import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { accessErrorResponse, requireFileAccess } from "@/lib/current-user";
import {
  parseMarkMutations,
  serializeMark,
  type DbMarkAttachmentRow,
  type DbMarkRow,
  type DbMarkTaskRow,
} from "@/lib/markup/serialize";

async function findCompanyFile(id: string, companyId: string) {
  return prisma.file.findFirst({
    where: { id, companyId },
    select: { id: true },
  });
}

async function loadMarks(fileId: string, companyId: string) {
  const rows = (await prisma.fileMarkupMark.findMany({
    where: { fileId, deletedAt: null },
    orderBy: { sequence: "asc" },
  })) as DbMarkRow[];
  const markIds = rows.map((row) => row.id);
  if (markIds.length === 0) return [];

  const [attachments, tasks] = await Promise.all([
    prisma.file.findMany({
      where: { companyId, markupMarkId: { in: markIds } },
      select: {
        id: true,
        type: true,
        originalName: true,
        name: true,
        category: true,
        contentType: true,
        sizeBytes: true,
        markupMarkId: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.task.findMany({
      where: { companyId, sourceMarkupMarkId: { in: markIds } },
      select: {
        id: true,
        title: true,
        status: true,
        type: true,
        dueDate: true,
        sourceMarkupMarkId: true,
      },
    }),
  ]);

  const attachmentsByMark = new Map<string, DbMarkAttachmentRow[]>();
  for (const attachment of attachments) {
    if (!attachment.markupMarkId) continue;
    const list = attachmentsByMark.get(attachment.markupMarkId) ?? [];
    list.push(attachment as DbMarkAttachmentRow);
    attachmentsByMark.set(attachment.markupMarkId, list);
  }

  const taskByMark = new Map<string, DbMarkTaskRow>();
  for (const task of tasks) {
    if (task.sourceMarkupMarkId) taskByMark.set(task.sourceMarkupMarkId, task as DbMarkTaskRow);
  }

  return rows.map((row) =>
    serializeMark(row, {
      attachments: attachmentsByMark.get(row.id) ?? [],
      task: taskByMark.get(row.id) ?? null,
    }),
  );
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { user } = await requireFileAccess(id);
    const file = await findCompanyFile(id, user.companyId);
    if (!file) return NextResponse.json({ error: "File not found" }, { status: 404 });

    return NextResponse.json({ marks: await loadMarks(file.id, user.companyId) });
  } catch (error) {
    const authResponse = accessErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("Error loading markup:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { user } = await requireFileAccess(id);
    const file = await findCompanyFile(id, user.companyId);
    if (!file) return NextResponse.json({ error: "File not found" }, { status: 404 });

    const parsed = parseMarkMutations(await req.json());
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

    // Load the marks named in this batch so we can apply per-mark
    // last-write-wins without one client's save clobbering another's.
    const ids = parsed.mutations.map((m) => (m.op === "upsert" ? m.mark.id : m.id));
    const existing = (await prisma.fileMarkupMark.findMany({
      where: { id: { in: ids }, fileId: file.id },
      select: { id: true, clientUpdatedAt: true },
    })) as { id: string; clientUpdatedAt: Date }[];
    const existingById = new Map(existing.map((row) => [row.id, row]));

    const ops = [];
    for (const mutation of parsed.mutations) {
      const targetId = mutation.op === "upsert" ? mutation.mark.id : mutation.id;
      const incomingAt = new Date(
        mutation.op === "upsert" ? mutation.mark.clientUpdatedAt : mutation.clientUpdatedAt,
      );
      const prev = existingById.get(targetId);

      // Skip stale writes — a newer edit of this mark already won.
      if (prev && prev.clientUpdatedAt > incomingAt) continue;

      if (mutation.op === "delete") {
        if (!prev) continue; // nothing to delete on this file
        ops.push(
          prisma.fileMarkupMark.update({
            where: { id: targetId },
            data: { deletedAt: new Date(), clientUpdatedAt: incomingAt },
          }),
        );
        continue;
      }

      const mark = mutation.mark;
      if (prev) {
        ops.push(
          prisma.fileMarkupMark.update({
            where: { id: targetId },
            data: {
              page: mark.page,
              kind: mark.kind,
              geometry: mark.geometry as Prisma.InputJsonValue,
              style: mark.style as Prisma.InputJsonValue,
              text: mark.text ?? null,
              sequence: mark.sequence,
              deletedAt: null,
              clientUpdatedAt: incomingAt,
            },
          }),
        );
      } else {
        ops.push(
          prisma.fileMarkupMark.create({
            data: {
              id: mark.id,
              fileId: file.id,
              companyId: user.companyId,
              authorId: user.id,
              page: mark.page,
              kind: mark.kind,
              geometry: mark.geometry as Prisma.InputJsonValue,
              style: mark.style as Prisma.InputJsonValue,
              text: mark.text ?? null,
              sequence: mark.sequence,
              clientUpdatedAt: incomingAt,
            },
          }),
        );
      }
    }

    if (ops.length > 0) {
      // Any change invalidates the cached flattened export.
      ops.push(
        prisma.fileMarkupExport.upsert({
          where: { fileId: file.id },
          create: { fileId: file.id, isStale: true },
          update: { isStale: true },
        }),
      );
      await prisma.$transaction(ops);
    }

    return NextResponse.json({ ok: true, applied: ops.length > 0 ? ops.length - 1 : 0 });
  } catch (error) {
    const authResponse = accessErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("Error saving markup:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
