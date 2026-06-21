"use client";

import type { LucideIcon } from "lucide-react";
import { ChevronLeft, ChevronRight, ClipboardList, FileText, Image as ImageIcon, ListTodo, Newspaper, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { JobSection } from "@/components/job-workspace/JobSectionContent";

export type SectionCounts = Partial<Record<JobSection, number>>;

type NavItem = { section: JobSection; label: string; Icon: LucideIcon };

const NAV_ITEMS: NavItem[] = [
  { section: "FEED", label: "Feed", Icon: Newspaper },
  { section: "FILES", label: "Files", Icon: FileText },
  { section: "PHOTOS", label: "Photos", Icon: ImageIcon },
  { section: "DAILY_REPORTS", label: "Daily Reports", Icon: ClipboardList },
  { section: "TASKS", label: "Tasks", Icon: ListTodo },
];

type Props = {
  activeSection: JobSection;
  counts: SectionCounts;
  onSelect: (section: JobSection) => void;
  expanded: boolean;
  onToggleExpanded: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
};

export function JobSidebar({
  activeSection,
  counts,
  onSelect,
  expanded,
  onToggleExpanded,
  mobileOpen,
  onCloseMobile,
}: Props) {
  return (
    <>
      {/* Desktop icon rail */}
      <aside
        className={cn(
          "hidden md:flex sticky top-16 h-[calc(100vh-5rem)] shrink-0 flex-col border-r border-zinc-800 bg-zinc-950/40 transition-[width] duration-200",
          expanded ? "w-52" : "w-16",
        )}
      >
        <button
          type="button"
          onClick={onToggleExpanded}
          aria-label={expanded ? "Collapse navigation" : "Expand navigation"}
          className="m-2 flex h-10 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
        >
          {expanded ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
        </button>
        <nav className="flex flex-col gap-1 px-2">
          {NAV_ITEMS.map((item) => (
            <NavButton
              key={item.section}
              item={item}
              active={activeSection === item.section}
              count={counts[item.section]}
              expanded={expanded}
              onClick={() => onSelect(item.section)}
            />
          ))}
        </nav>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-zinc-950/70 backdrop-blur-sm" onClick={onCloseMobile} />
          <aside className="absolute inset-y-0 left-0 w-64 border-r border-zinc-800 bg-zinc-950 p-3 shadow-2xl">
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="text-sm font-semibold text-zinc-300">Sections</span>
              <button
                type="button"
                onClick={onCloseMobile}
                aria-label="Close navigation"
                className="rounded-full p-2 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
              >
                <X size={18} />
              </button>
            </div>
            <nav className="flex flex-col gap-1">
              {NAV_ITEMS.map((item) => (
                <NavButton
                  key={item.section}
                  item={item}
                  active={activeSection === item.section}
                  count={counts[item.section]}
                  expanded
                  onClick={() => {
                    onSelect(item.section);
                    onCloseMobile();
                  }}
                />
              ))}
            </nav>
          </aside>
        </div>
      )}
    </>
  );
}

function NavButton({
  item,
  active,
  count,
  expanded,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  count: number | undefined;
  expanded: boolean;
  onClick: () => void;
}) {
  const { Icon, label } = item;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      title={label}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
        expanded ? "justify-start" : "justify-center",
        active ? "bg-brand/10 text-brand-light" : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100",
      )}
    >
      <Icon size={20} className="shrink-0" />
      {expanded && <span className="flex-1 text-left">{label}</span>}
      {expanded && typeof count === "number" && (
        <span
          className={cn(
            "ml-auto rounded-full px-2 py-0.5 text-xs font-semibold",
            active ? "bg-brand/20 text-brand-light" : "bg-zinc-800 text-zinc-400",
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}
