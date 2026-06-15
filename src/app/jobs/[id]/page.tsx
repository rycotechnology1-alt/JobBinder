import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import prisma from "@/lib/prisma";
import { requirePageCompanyUser } from "@/lib/current-user";
import { Card, CardContent } from "@/components/ui/Card";
import { JobActions } from "@/components/JobActions";
import { JobFolderTabs } from "@/components/JobFolderTabs";
import { ManageJobDialog } from "@/components/ManageJobDialog";
import { JobStatusCard } from "@/components/JobStatusCard";
import { JobOverviewCard } from "@/components/JobOverviewCard";
import { buildAccessibleJobWhere, isAccountManagerRole } from "@/lib/account-access";

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
      tasks: { orderBy: { createdAt: "desc" } },
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

  const feedFiles = job.files.map((file) => ({
    id: file.id,
    type: file.type,
    originalName: file.originalName,
    name: file.name,
    category: file.category,
    noteId: file.noteId,
    createdAt: file.createdAt.toISOString(),
  }));

  const taskItems = job.tasks.map((task) => ({
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    type: task.type,
    priority: task.priority,
    dueDate: task.dueDate?.toISOString() ?? null,
    createdAt: task.createdAt.toISOString(),
  }));

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-4">
        <Link href="/dashboard" className="p-2 rounded-full hover:bg-zinc-800 transition-colors">
          <ArrowLeft size={20} className="text-zinc-400" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl md:text-3xl font-bold">{job.title}</h1>
        </div>
        <ManageJobDialog
          isAdmin={isAdmin}
          job={{
            id: job.id,
            title: job.title,
            jobNumber: job.jobNumber,
            poNumber: job.poNumber,
            contractNumber: job.contractNumber,
            customerName: job.customerName,
            address: job.address,
            contactName: job.contactName,
            contactPhone: job.contactPhone,
            contactEmail: job.contactEmail,
            description: job.description,
            status: job.status,
            priority: job.priority,
            targetCompletionDate: job.targetCompletionDate?.toISOString() ?? null,
          }}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="space-y-6 lg:col-span-1">
          <JobStatusCard
            isAdmin={isAdmin}
            job={{
              id: job.id,
              status: job.status,
              priority: job.priority,
              targetCompletionDate: job.targetCompletionDate?.toISOString() ?? null,
            }}
          />
          <JobOverviewCard
            job={{
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
          />
        </div>

        <div className="lg:col-span-2 space-y-6">
          <JobActions jobId={job.id} isAdmin={isAdmin} />

          <Card>
            <CardContent className="p-0">
              <JobFolderTabs notes={feedNotes} files={feedFiles} tasks={taskItems} isAdmin={isAdmin} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
