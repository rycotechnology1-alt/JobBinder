import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { MapPin, Phone, User, CalendarClock, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { JobActions } from "@/components/JobActions";

export default async function JobFolder({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const job = await prisma.job.findUnique({
    where: { id },
    include: {
      company: { include: { users: true } },
      notes: { orderBy: { createdAt: "desc" } },
      files: { orderBy: { createdAt: "desc" } },
      tasks: { orderBy: { createdAt: "desc" } }
    }
  });

  if (!job) return notFound();

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
          
          <JobActions 
            jobId={job.id} 
            companyId={job.companyId} 
            authorId={job.company?.users?.[0]?.id || "default"} 
          />

          <Card>
            <CardContent className="p-0">
              <div className="flex border-b border-zinc-800">
                <button className="px-6 py-4 text-sm font-medium text-brand border-b-2 border-brand">Feed</button>
                <button className="px-6 py-4 text-sm font-medium text-zinc-400 hover:text-zinc-300">Files ({job.files.length})</button>
                <button className="px-6 py-4 text-sm font-medium text-zinc-400 hover:text-zinc-300">Tasks ({job.tasks.length})</button>
              </div>

              <div className="p-6">
                {job.notes.length === 0 ? (
                  <p className="text-zinc-500 text-center py-10">No activity yet. Log some progress or add a note!</p>
                ) : (
                  <div className="space-y-6">
                    {job.notes.map(note => (
                      <div key={note.id} className="flex gap-4">
                        <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center shrink-0">
                          <User size={16} className="text-zinc-400" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-sm text-zinc-200">User</span>
                            <span className="text-xs text-zinc-500">{new Date(note.createdAt).toLocaleDateString()}</span>
                            {note.type === "PROGRESS" && (
                              <Badge variant="success" className="scale-75 origin-left">Progress</Badge>
                            )}
                          </div>
                          <p className="text-zinc-400 text-sm leading-relaxed">{note.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
}
