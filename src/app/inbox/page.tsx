import prisma from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/Card";
import { InboxIcon, FileIcon, FileText } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { requirePageCompanyUser } from "@/lib/current-user";
import { InboxUploadButton } from "@/components/InboxUploadButton";
import { InboxItemActions } from "@/components/InboxItemActions";
import { buildAccessibleJobWhere, isAccountManagerRole } from "@/lib/account-access";

export default async function InboxPage() {
  const user = await requirePageCompanyUser();

  const [notes, files, jobs] = await Promise.all([
    prisma.note.findMany({
      where: {
        companyId: user.companyId,
        jobId: null,
        ...(isAccountManagerRole(user.role) ? {} : { authorId: user.id }),
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.file.findMany({
      where: {
        companyId: user.companyId,
        jobId: null,
        ...(isAccountManagerRole(user.role) ? {} : { uploaderId: user.id }),
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.job.findMany({
      where: {
        ...buildAccessibleJobWhere({
          companyId: user.companyId,
          membershipId: user.membershipId,
          role: user.role,
          crewIds: user.crewIds,
          orgUnitIds: user.orgUnitIds,
        }),
        status: { not: "COMPLETE" },
      },
      orderBy: [
        { priority: "desc" },
        { updatedAt: "desc" },
      ],
      select: {
        id: true,
        title: true,
        customerName: true,
      },
    }),
  ]);

  const hasItems = notes.length > 0 || files.length > 0;

  return (
    <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl mx-auto pt-4">
      <div className="glass rounded-2xl p-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3 text-white">
            <InboxIcon size={24} className="text-brand" /> Unsorted Inbox
          </h1>
          <p className="text-sm text-zinc-400 mt-1">Review fast captures and organize them into job folders.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <InboxUploadButton />
        </div>
      </div>

      {!hasItems ? (
        <div className="flex flex-col items-center justify-center py-24 text-center glass rounded-2xl border-dashed">
          <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mb-4">
            <InboxIcon size={24} className="text-zinc-500" />
          </div>
          <h3 className="text-xl font-semibold text-zinc-300">Inbox is empty</h3>
          <p className="text-zinc-500 mt-2 max-w-sm">When your crew captures photos or notes offline without picking a job, they land here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {notes.map(note => (
            <Card key={note.id} className="group">
              <CardContent className="p-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-4">
                  <div className="w-10 h-10 bg-zinc-800 rounded-lg flex shrink-0 items-center justify-center">
                    <FileText size={20} className="text-zinc-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-zinc-200 line-clamp-1">{note.content}</p>
                    <p className="text-xs text-zinc-500">Captured {formatDistanceToNow(new Date(note.createdAt), { addSuffix: true })}</p>
                  </div>
                </div>
                <InboxItemActions itemType="note" itemId={note.id} jobs={jobs} />
              </CardContent>
            </Card>
          ))}

          {files.map(file => (
            <Card key={file.id} className="group">
              <CardContent className="p-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-4">
                  <div className="w-10 h-10 bg-zinc-800 rounded-lg flex shrink-0 items-center justify-center">
                    <FileIcon size={20} className="text-zinc-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-zinc-200 truncate">{file.name || file.originalName}</p>
                    <p className="text-xs text-zinc-500">
                      Uploaded {formatDistanceToNow(new Date(file.createdAt), { addSuffix: true })}
                      {file.category ? ` - ${file.category}` : ""}
                    </p>
                  </div>
                </div>
                <InboxItemActions itemType="file" itemId={file.id} jobs={jobs} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
