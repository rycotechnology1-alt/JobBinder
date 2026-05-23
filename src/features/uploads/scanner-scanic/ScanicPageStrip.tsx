"use client";

/* eslint-disable @next/next/no-img-element */

import type { ScanicPage } from "./scanicTypes";

type Props = {
  pages: ScanicPage[];
  selectedPageId: string | null;
  onSelectPage: (pageId: string) => void;
};

export function ScanicPageStrip({ pages, selectedPageId, onSelectPage }: Props) {
  if (pages.length === 0) return null;

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {pages.map((page, index) => (
        <button
          key={page.id}
          type="button"
          onClick={() => onSelectPage(page.id)}
          className={`h-16 w-12 shrink-0 overflow-hidden rounded-md border bg-zinc-950 ${
            selectedPageId === page.id ? "border-emerald-400" : "border-zinc-800"
          }`}
          aria-label={`Select scanned page ${index + 1}`}
        >
          <img src={page.objectUrl} alt="" className="h-full w-full object-cover" />
        </button>
      ))}
    </div>
  );
}
