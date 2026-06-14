"use client";

import { useMemo, useState } from "react";
import { User } from "lucide-react";
import { ASSET_CATEGORIES } from "@/lib/asset-categories";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import { FilePreview } from "@/components/FilePreview";
import { DeleteConfirmationButton } from "@/components/DeleteConfirmationButton";

type NoteItem = {
  id: string;
  type: "GENERAL" | "PROGRESS" | "DAILY_REPORT";
  content: string;
  category: string | null;
  statusTag: string | null;
  reportDate: string | null;
  materialsUsed: string | null;
  createdAt: string;
  authorName: string;
};

type FileItem = {
  id: string;
  type: "PHOTO" | "DOCUMENT";
  originalName: string;
  name: string | null;
  category: string | null;
  noteId: string | null;
  createdAt: string;
};

type Props = {
  notes: NoteItem[];
  files: FileItem[];
  isAdmin: boolean;
  onItemDeleted: () => void;
};

type FeedItem =
  | ({ kind: "note" } & NoteItem)
  | ({ kind: "file" } & FileItem);

function formatDisplayDate(value: string) {
  const dateOnly = value.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
    const [year, month, day] = dateOnly.split("-").map(Number);
    return new Date(year, month - 1, day).toLocaleDateString();
  }

  return new Date(value).toLocaleDateString();
}

export function JobFeed({ notes, files, isAdmin, onItemDeleted }: Props) {
  const [selectedCategory, setSelectedCategory] = useState("All");
  const filesByNoteId = useMemo(() => {
    const grouped = new Map<string, FileItem[]>();
    for (const file of files) {
      if (!file.noteId) continue;
      grouped.set(file.noteId, [...(grouped.get(file.noteId) ?? []), file]);
    }
    return grouped;
  }, [files]);

  const feedItems = useMemo<FeedItem[]>(() => {
    return [
      ...notes.map((note) => ({ ...note, kind: "note" as const })),
      ...files.filter((file) => !file.noteId).map((file) => ({ ...file, kind: "file" as const })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [notes, files]);

  const filteredItems = feedItems.filter((item) => {
    return selectedCategory === "All" || item.category === selectedCategory;
  });

  if (feedItems.length === 0) {
    return (
      <p className="text-zinc-500 text-center py-10">No activity yet. Upload a file, log progress, or add a note.</p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-2 overflow-x-auto pb-2">
        {["All", ...ASSET_CATEGORIES].map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => setSelectedCategory(category)}
            className={cn(
              "h-9 px-3 rounded-full text-xs font-semibold whitespace-nowrap border transition-colors",
              selectedCategory === category
                ? "bg-brand text-white border-brand"
                : "bg-zinc-900/50 text-zinc-400 border-zinc-800 hover:text-zinc-200 hover:border-zinc-700",
            )}
          >
            {category}
          </button>
        ))}
      </div>

      {filteredItems.length === 0 ? (
        <p className="text-zinc-500 text-center py-10">No activity in this category yet.</p>
      ) : (
        <div className="space-y-6">
          {filteredItems.map((item) => {
            if (item.kind === "file") {
              return (
                <div key={`file-${item.id}`} className="space-y-2">
                  <p className="text-xs text-zinc-500">{formatDisplayDate(item.createdAt)}</p>
                  <FilePreview
                    fileId={item.id}
                    type={item.type}
                    filename={item.name || item.originalName}
                    category={item.category}
                    canDelete={isAdmin}
                    onDelete={onItemDeleted}
                  />
                </div>
              );
            }

            if (item.type === "DAILY_REPORT" || item.type === "PROGRESS") {
              return (
                <DailyReportFeedItem
                  key={`report-${item.id}`}
                  report={item}
                  files={filesByNoteId.get(item.id) ?? []}
                  isAdmin={isAdmin}
                  onItemDeleted={onItemDeleted}
                />
              );
            }

            return (
              <div key={`note-${item.id}`} className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center shrink-0">
                  <User size={16} className="text-zinc-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="font-medium text-sm text-zinc-200">{item.authorName}</span>
                    <span className="text-xs text-zinc-500">{formatDisplayDate(item.createdAt)}</span>
                    {item.category && <Badge variant="brand" className="scale-75 origin-left">{item.category}</Badge>}
                  </div>
                  {item.statusTag && <p className="text-xs text-brand-light mb-1">{item.statusTag}</p>}
                  <p className="text-zinc-400 text-sm leading-relaxed">{item.content}</p>
                </div>
                {isAdmin && (
                  <DeleteConfirmationButton
                    endpoint={`/api/notes/${item.id}`}
                    label={`Delete ${item.content}`}
                    title="Delete note"
                    message="Delete this note from the job? This cannot be undone."
                    onDeleted={onItemDeleted}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DailyReportFeedItem({
  report,
  files,
  isAdmin,
  onItemDeleted,
}: {
  report: NoteItem;
  files: FileItem[];
  isAdmin: boolean;
  onItemDeleted: () => void;
}) {
  const reportDate = formatDisplayDate(report.reportDate || report.createdAt);

  return (
    <div className="rounded-xl border border-zinc-800 bg-black/20 p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-sm text-zinc-200">{report.authorName}</span>
            <span className="text-xs text-zinc-500">{reportDate}</span>
            <Badge variant="success" className="scale-75 origin-left">
              {report.type === "PROGRESS" ? "Legacy Daily Report" : "Daily Report"}
            </Badge>
          </div>
          {report.statusTag && <p className="text-xs text-brand-light mt-1">{report.statusTag}</p>}
        </div>
        {isAdmin && (
          <DeleteConfirmationButton
            endpoint={`/api/notes/${report.id}`}
            label={`Delete daily report from ${reportDate}`}
            title="Delete daily report"
            message="Delete this daily report from the job? This cannot be undone."
            onDeleted={onItemDeleted}
          />
        )}
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Work Performed</p>
        <p className="mt-1 text-sm leading-relaxed text-zinc-300">{report.content}</p>
      </div>

      {report.materialsUsed && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Materials Used</p>
          <p className="mt-1 text-sm leading-relaxed text-zinc-300">{report.materialsUsed}</p>
        </div>
      )}

      {files.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Attachments</p>
          {files.map((file) => (
            <FilePreview
              key={file.id}
              fileId={file.id}
              type={file.type}
              filename={file.name || file.originalName}
              category={file.category}
              canDelete={isAdmin}
              onDelete={onItemDeleted}
            />
          ))}
        </div>
      )}
    </div>
  );
}
