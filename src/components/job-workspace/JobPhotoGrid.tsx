"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { ImageIcon } from "lucide-react";
import { ASSET_CATEGORIES } from "@/lib/asset-categories";
import { cn } from "@/lib/utils";
import { getOriginalContentUrl } from "@/lib/file-preview";
import { FileViewerOverlay } from "@/components/FileViewerOverlay";
import { DeleteConfirmationButton } from "@/components/DeleteConfirmationButton";

export type PhotoItem = {
  id: string;
  type: "PHOTO" | "DOCUMENT";
  originalName: string;
  name: string | null;
  category: string | null;
  createdAt: string;
};

type Props = {
  photos: PhotoItem[];
  isAdmin: boolean;
  onDeleted: () => void;
};

function groupKey(createdAt: string) {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "unknown";
  return format(date, "yyyy-MM-dd");
}

function groupLabel(key: string) {
  if (key === "unknown") return "Undated";
  const [year, month, day] = key.split("-").map(Number);
  return format(new Date(year, month - 1, day), "MMM d, yyyy");
}

export function JobPhotoGrid({ photos, isAdmin, onDeleted }: Props) {
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [activePhotoId, setActivePhotoId] = useState<string | null>(null);

  const categoryCounts = useMemo(() => {
    return ASSET_CATEGORIES.reduce<Record<string, number>>((counts, category) => {
      counts[category] = photos.filter((photo) => photo.category === category).length;
      return counts;
    }, {});
  }, [photos]);

  const visiblePhotos = selectedCategory === "All"
    ? photos
    : photos.filter((photo) => photo.category === selectedCategory);

  const groups = useMemo(() => {
    const map = new Map<string, PhotoItem[]>();
    const sorted = [...visiblePhotos].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    for (const photo of sorted) {
      const key = groupKey(photo.createdAt);
      map.set(key, [...(map.get(key) ?? []), photo]);
    }
    return Array.from(map.entries());
  }, [visiblePhotos]);

  const activePhoto = activePhotoId ? photos.find((photo) => photo.id === activePhotoId) ?? null : null;

  if (photos.length === 0) {
    return (
      <p className="text-zinc-500 text-center py-10">
        No photos yet. Upload a photo, or add one to a task or markup pin.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-2 overflow-x-auto pb-2">
        <FilterChip
          label={`All (${photos.length})`}
          active={selectedCategory === "All"}
          onClick={() => setSelectedCategory("All")}
        />
        {ASSET_CATEGORIES.map((category) => (
          <FilterChip
            key={category}
            label={`${category} (${categoryCounts[category] ?? 0})`}
            active={selectedCategory === category}
            onClick={() => setSelectedCategory(category)}
          />
        ))}
      </div>

      {visiblePhotos.length === 0 ? (
        <p className="text-zinc-500 text-center py-10">No photos in this category yet.</p>
      ) : (
        <div className="space-y-6">
          {groups.map(([key, groupPhotos]) => (
            <section key={key} className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                {groupLabel(key)} ({groupPhotos.length})
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1">
                {groupPhotos.map((photo) => (
                  <PhotoTile
                    key={photo.id}
                    photo={photo}
                    isAdmin={isAdmin}
                    onOpen={() => setActivePhotoId(photo.id)}
                    onDeleted={onDeleted}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {activePhoto && (
        <FileViewerOverlay
          fileId={activePhoto.id}
          isOpen={Boolean(activePhoto)}
          onClose={() => setActivePhotoId(null)}
          initialFilename={activePhoto.name || activePhoto.originalName}
        />
      )}
    </div>
  );
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-9 px-3 rounded-full text-xs font-semibold whitespace-nowrap border transition-colors",
        active
          ? "bg-brand text-white border-brand"
          : "bg-zinc-900/50 text-zinc-400 border-zinc-800 hover:text-zinc-200 hover:border-zinc-700",
      )}
    >
      {label}
    </button>
  );
}

function PhotoTile({
  photo,
  isAdmin,
  onOpen,
  onDeleted,
}: {
  photo: PhotoItem;
  isAdmin: boolean;
  onOpen: () => void;
  onDeleted: () => void;
}) {
  const filename = photo.name || photo.originalName;

  return (
    <div className="group relative aspect-square overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900">
      <button type="button" onClick={onOpen} className="absolute inset-0 h-full w-full">
        <span className="sr-only">View {filename}</span>
        <ImageIcon size={24} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-zinc-700" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={getOriginalContentUrl(photo.id)}
          alt={filename}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover"
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        />
      </button>
      {isAdmin && (
        <div className="absolute right-1 top-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <DeleteConfirmationButton
            endpoint={`/api/files/${photo.id}`}
            label={`Delete ${filename}`}
            title="Delete photo"
            message={`Delete ${filename} from this job? This cannot be undone.`}
            onDeleted={onDeleted}
          />
        </div>
      )}
    </div>
  );
}
