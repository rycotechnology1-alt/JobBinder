import prisma from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { InboxIcon, FileIcon, FileText } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { SimulateCaptureButton } from "@/components/SimulateCaptureButton";

export default async function InboxPage() {
  const company = await prisma.company.findFirst({
    include: { users: true }
  });
  if (!company) return <div>No company found</div>;

  const [notes, files] = await Promise.all([
    prisma.note.findMany({
      where: { companyId: company.id, jobId: null },
      orderBy: { createdAt: "desc" },
    }),
    prisma.file.findMany({
      where: { companyId: company.id, jobId: null },
      orderBy: { createdAt: "desc" },
    })
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
        <SimulateCaptureButton companyId={company.id} authorId={company.users[0]?.id || "default"} />
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
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-zinc-800 rounded-lg flex items-center justify-center">
                    <FileText size={20} className="text-zinc-400" />
                  </div>
                  <div>
                    <p className="font-medium text-zinc-200 line-clamp-1">{note.content}</p>
                    <p className="text-xs text-zinc-500">Captured {formatDistanceToNow(new Date(note.createdAt), { addSuffix: true })}</p>
                  </div>
                </div>
                <Button variant="secondary" size="sm">Assign to Job</Button>
              </CardContent>
            </Card>
          ))}

          {files.map(file => (
            <Card key={file.id} className="group">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-zinc-800 rounded-lg flex items-center justify-center">
                    <FileIcon size={20} className="text-zinc-400" />
                  </div>
                  <div>
                    <p className="font-medium text-zinc-200">{file.originalName}</p>
                    <p className="text-xs text-zinc-500">Uploaded {formatDistanceToNow(new Date(file.createdAt), { addSuffix: true })}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">View</Button>
                  <Button variant="secondary" size="sm">Assign to Job</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
