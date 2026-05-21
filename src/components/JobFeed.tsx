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
  type: "GENERAL" | "PROGRESS";
  content: string;
  category: string | null;
  statusTag: string | null;
  createdAt: string;
  authorName: string;
};

type FileItem = {
  id: string;
  type: "PHOTO" | "DOCUMENT";
  originalName: string;
  name: string | null;
  category: string | null;
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

export function JobFeed({ notes, files, isAdmin, onItemDeleted }: Props) {
  const [selectedCategory, setSelectedCategory] = useState("All");

  const feedItems = useMemo<FeedItem[]>(() => {
    return [
      ...notes.map((note) => ({ ...note, kind: "note" as const })),
      ...files.map((file) => ({ ...file, kind: "file" as const })),
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
                  <p className="text-xs text-zinc-500">{new Date(item.createdAt).toLocaleDateString()}</p>
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

            return (
              <div key={`note-${item.id}`} className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center shrink-0">
                  <User size={16} className="text-zinc-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="font-medium text-sm text-zinc-200">{item.authorName}</span>
                    <span className="text-xs text-zinc-500">{new Date(item.createdAt).toLocaleDateString()}</span>
                    {item.type === "PROGRESS" && (
                      <Badge variant="success" className="scale-75 origin-left">Progress</Badge>
                    )}
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
