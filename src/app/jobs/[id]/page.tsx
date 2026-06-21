import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { requirePageCompanyUser } from "@/lib/current-user";
import { JobWorkspace } from "@/components/job-workspace/JobWorkspace";
import { buildAccessibleJobWhere, isAccountManagerRole } from "@/lib/account-access";
import { getFilePreviewInfo } from "@/lib/file-preview";

export default async function JobFolder({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePageCompanyUser();

  const job = await prisma.job.findFirst({
    where: {
      id,
      ...buildAccessibleJobWhere({
        companyId: user.companyId,
        membershipId: user.membershipId,
        role: user.role,
        crewIds: user.crewIds,
        orgUnitIds: user.orgUnitIds,
      }),
    },
    include: {
      notes: {
        orderBy: { createdAt: "desc" },
        include: { author: { select: { name: true, email: true } } },
      },
      files: { orderBy: { createdAt: "desc" } },
      tasks: {
        orderBy: { createdAt: "desc" },
        include: {
          files: { orderBy: { createdAt: "desc" } },
        },
      },
    },
  });

  if (!job) return notFound();

  const isAdmin = isAccountManagerRole(user.role);

  const feedNotes = job.notes.map((note) => ({
    id: note.id,
    type: note.type,
    content: note.content,
    category: note.category,
    statusTag: note.statusTag,
    reportDate: note.reportDate?.toISOString() ?? null,
    materialsUsed: note.materialsUsed,
    createdAt: note.createdAt.toISOString(),
    authorName: note.author.name ?? note.author.email ?? "User",
  }));

  const feedFiles = job.files.map((file) => {
    const filename = file.name || file.originalName;
    const previewInfo = getFilePreviewInfo({ filename, contentType: file.contentType });

    return {
      id: file.id,
      type: file.type,
      originalName: file.originalName,
      name: file.name,
      category: file.category,
      contentType: previewInfo.contentType,
      sizeBytes: file.sizeBytes,
      renderMode: previewInfo.renderMode,
      noteId: file.noteId,
      taskId: file.taskId,
      markupMarkId: file.markupMarkId,
      createdAt: file.createdAt.toISOString(),
    };
  });

  const taskItems = job.tasks.map((task) => ({
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    type: task.type,
    priority: task.priority,
    dueDate: task.dueDate?.toISOString() ?? null,
    createdAt: task.createdAt.toISOString(),
    files: task.files.map((file) => {
      const filename = file.name || file.originalName;
      const previewInfo = getFilePreviewInfo({ filename, contentType: file.contentType });

      return {
        id: file.id,
        type: file.type,
        originalName: file.originalName,
        name: file.name,
        category: file.category,
        contentType: previewInfo.contentType,
        sizeBytes: file.sizeBytes,
        renderMode: previewInfo.renderMode,
        noteId: file.noteId,
        taskId: file.taskId,
        markupMarkId: file.markupMarkId,
        createdAt: file.createdAt.toISOString(),
      };
    }),
  }));

  return (
    <JobWorkspace
      isAdmin={isAdmin}
      job={{
        id: job.id,
        title: job.title,
        status: job.status,
        priority: job.priority,
        targetCompletionDate: job.targetCompletionDate?.toISOString() ?? null,
        customerName: job.customerName,
        address: job.address,
        contactName: job.contactName,
        contactPhone: job.contactPhone,
        contactEmail: job.contactEmail,
        jobNumber: job.jobNumber,
        poNumber: job.poNumber,
        contractNumber: job.contractNumber,
        description: job.description,
      }}
      notes={feedNotes}
      files={feedFiles}
      tasks={taskItems}
    />
  );
}
