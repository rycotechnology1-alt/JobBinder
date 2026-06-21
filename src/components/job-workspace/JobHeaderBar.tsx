"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronDown, ChevronUp, Menu } from "lucide-react";
import { formatTargetCompletionDate } from "@/lib/job-management";
import { JobActions } from "@/components/JobActions";
import { JobStatusCard } from "@/components/JobStatusCard";
import { JobOverviewCard } from "@/components/JobOverviewCard";
import { ManageJobDialog } from "@/components/ManageJobDialog";

export type HeaderJob = {
  id: string;
  title: string;
  status: string;
  priority: number;
  targetCompletionDate: string | null;
  customerName: string | null;
  address: string | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  jobNumber: string | null;
  poNumber: string | null;
  contractNumber: string | null;
  description: string | null;
};

type Props = {
  job: HeaderJob;
  isAdmin: boolean;
  onOpenMobileNav: () => void;
};

export function JobHeaderBar({ job, isAdmin, onOpenMobileNav }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);

  const dueLabel = formatTargetCompletionDate(job.targetCompletionDate);

  return (
    <header className="sticky top-16 z-30 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur">
      <div className="flex items-center gap-2 px-3 py-2 md:px-4">
        <button
          type="button"
          onClick={onOpenMobileNav}
          aria-label="Open navigation"
          className="md:hidden rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
        >
          <Menu size={20} />
        </button>

        <Link
          href="/dashboard"
          aria-label="Back to dashboard"
          className="rounded-full p-2 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
        >
          <ArrowLeft size={18} />
        </Link>

        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          aria-expanded={expanded}
          aria-label={expanded ? "Hide job details" : "Show job details"}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-zinc-800/50"
        >
          <span className="min-w-0 flex-1 truncate text-base font-bold text-zinc-50 md:text-lg">{job.title}</span>
          {dueLabel && <span className="hidden shrink-0 text-xs text-zinc-500 sm:inline">· {dueLabel}</span>}
          {expanded ? (
            <ChevronUp size={16} className="shrink-0 text-zinc-500" />
          ) : (
            <ChevronDown size={16} className="shrink-0 text-zinc-500" />
          )}
        </button>

        <div className="shrink-0">
          <JobActions jobId={job.id} isAdmin={isAdmin} onManageJob={() => setManageOpen(true)} />
        </div>
      </div>

      {expanded && (
        <div className="space-y-4 border-t border-zinc-800 bg-zinc-950/40 p-3 md:p-4">
          <JobStatusCard
            isAdmin={isAdmin}
            job={{
              id: job.id,
              status: job.status,
              priority: job.priority,
              targetCompletionDate: job.targetCompletionDate,
            }}
          />
          <JobOverviewCard
            job={{
              customerName: job.customerName,
              address: job.address,
              contactName: job.contactName,
              contactPhone: job.contactPhone,
              contactEmail: job.contactEmail,
              jobNumber: job.jobNumber,
              poNumber: job.poNumber,
              contractNumber: job.contractNumber,
              description: job.description,
            }}
          />
        </div>
      )}

      <ManageJobDialog
        isAdmin={isAdmin}
        showTrigger={false}
        open={manageOpen}
        onOpenChange={setManageOpen}
        job={{
          id: job.id,
          title: job.title,
          jobNumber: job.jobNumber,
          poNumber: job.poNumber,
          contractNumber: job.contractNumber,
          customerName: job.customerName,
          address: job.address,
          contactName: job.contactName,
          contactPhone: job.contactPhone,
          contactEmail: job.contactEmail,
          description: job.description,
          status: job.status,
          priority: job.priority,
          targetCompletionDate: job.targetCompletionDate,
        }}
      />
    </header>
  );
}
