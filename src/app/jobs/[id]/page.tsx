import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { MapPin, Phone, User, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { JobActions } from "@/components/JobActions";
import { requirePageCompanyUser } from "@/lib/current-user";
import { JobFolderTabs } from "@/components/JobFolderTabs";

export default async function JobFolder({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePageCompanyUser();

  const job = await prisma.job.findFirst({
    where: { id, companyId: user.companyId },
    include: {
      notes: {
        orderBy: { createdAt: "desc" },
        include: { author: { select: { name: true, email: true } } },
      },
      files: { orderBy: { createdAt: "desc" } },
      tasks: { orderBy: { createdAt: "desc" } }
    }
  });

  if (!job) return notFound();

  const feedNotes = job.notes.map((note) => ({
    id: note.id,
    type: note.type,
    content: note.content,
    category: note.category,
    statusTag: note.statusTag,
    createdAt: note.createdAt.toISOString(),
    authorName: note.author.name ?? note.author.email ?? "User",
  }));

  const feedFiles = job.files.map((file) => ({
    id: file.id,
    type: file.type,
    originalName: file.originalName,
    name: file.name,
    category: file.category,
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
      
      {/* Top Header */}
      <div className="flex items-center gap-4">
        <Link href="/" className="p-2 rounded-full hover:bg-zinc-800 transition-colors">
          <ArrowLeft size={20} className="text-zinc-400" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <Badge variant={job.status === "ACTIVE" ? "brand" : "default"}>
              {job.status.replace("_", " ")}
            </Badge>
            <span className="text-sm font-semibold text-zinc-400">Priority {job.priority}</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold">{job.title}</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Overview */}
        <div className="space-y-6 lg:col-span-1">
          <Card>
            <CardContent className="p-6 space-y-4">
              <h3 className="text-lg font-semibold border-b border-zinc-800 pb-2 mb-4">Overview</h3>
              
              {job.customerName && (
                <div className="flex items-start gap-3">
                  <User size={18} className="text-zinc-500 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Customer</p>
                    <p className="text-zinc-400 text-sm">{job.customerName}</p>
                  </div>
                </div>
              )}

              {job.address && (
                <div className="flex items-start gap-3">
                  <MapPin size={18} className="text-zinc-500 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Address</p>
                    <p className="text-zinc-400 text-sm">{job.address}</p>
                  </div>
                </div>
              )}

              {job.contactPhone && (
                <div className="flex items-start gap-3">
                  <Phone size={18} className="text-zinc-500 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Phone</p>
                    <p className="text-zinc-400 text-sm">{job.contactPhone}</p>
                  </div>
                </div>
              )}

              <div className="pt-4 flex flex-col gap-2 border-t border-zinc-800">
                {job.jobNumber && <p className="text-xs text-zinc-500">Job #: {job.jobNumber}</p>}
                {job.poNumber && <p className="text-xs text-zinc-500">PO #: {job.poNumber}</p>}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Feed */}
        <div className="lg:col-span-2 space-y-6">
          
          <JobActions jobId={job.id} />

          <Card>
            <CardContent className="p-0">
              <JobFolderTabs notes={feedNotes} files={feedFiles} tasks={taskItems} />
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
}
