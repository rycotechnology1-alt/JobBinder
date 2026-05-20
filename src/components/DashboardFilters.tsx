"use client";

import { FormEvent, useState } from "react";
import { Search, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import {
  type DashboardStatusFilter,
  DASHBOARD_STATUS_FILTERS,
  normalizeDashboardStatusFilter,
} from "@/lib/job-management";
import { cn } from "@/lib/utils";

type Props = {
  currentSearch?: string;
  currentStatus?: DashboardStatusFilter;
};

const STATUS_LABELS: Record<DashboardStatusFilter, string> = {
  all: "All",
  active: "Active",
  delay: "Delay",
  complete: "Complete",
};

export function DashboardFilters({ currentSearch = "", currentStatus = "all" }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [search, setSearch] = useState(currentSearch);
  const normalizedStatus = normalizeDashboardStatusFilter(currentStatus);
  const hasFilters = currentSearch.length > 0 || normalizedStatus !== "all";

  function replaceFilters(nextSearch: string, nextStatus: DashboardStatusFilter) {
    const params = new URLSearchParams();
    const trimmedSearch = nextSearch.trim();

    if (trimmedSearch) params.set("search", trimmedSearch);
    if (nextStatus !== "all") params.set("status", nextStatus);

    const queryString = params.toString();
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    replaceFilters(search, normalizedStatus);
  }

  return (
    <div className="flex w-full flex-col gap-3 md:w-auto md:min-w-[520px]">
      <form onSubmit={handleSubmit} role="search" className="flex w-full items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
          <input
            aria-label="Search jobs"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search jobs..."
            className="h-10 w-full rounded-full border border-white/10 bg-black/40 pl-10 pr-4 text-sm text-zinc-200 transition-colors placeholder:text-zinc-500 focus:border-brand/50 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          className="h-10 rounded-full border border-white/10 bg-white/5 px-4 text-xs font-bold uppercase tracking-widest text-zinc-300 transition-colors hover:border-brand/50 hover:text-white focus:outline-none focus:ring-2 focus:ring-brand"
        >
          Search
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        {DASHBOARD_STATUS_FILTERS.map((status) => (
          <button
            key={status}
            type="button"
            aria-pressed={normalizedStatus === status}
            onClick={() => replaceFilters(search, status)}
            className={cn(
              "h-8 rounded-full border px-3 text-[11px] font-bold uppercase tracking-widest transition-colors focus:outline-none focus:ring-2 focus:ring-brand",
              normalizedStatus === status
                ? "border-brand/60 bg-brand/20 text-brand-light"
                : "border-white/10 bg-white/5 text-zinc-500 hover:border-white/20 hover:text-zinc-300",
            )}
          >
            {STATUS_LABELS[status]}
          </button>
        ))}
        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setSearch("");
              replaceFilters("", "all");
            }}
            className="inline-flex h-8 items-center gap-1 rounded-full border border-white/10 bg-transparent px-3 text-[11px] font-bold uppercase tracking-widest text-zinc-500 transition-colors hover:border-red-500/30 hover:text-red-300 focus:outline-none focus:ring-2 focus:ring-brand"
          >
            <X size={12} />
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}
