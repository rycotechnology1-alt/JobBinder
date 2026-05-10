import Link from "next/link";
import { AlertTriangle, CalendarDays, MapPin } from "lucide-react";
import { Card, CardContent, CardFooter } from "@/components/ui/Card";
import {
  calculateCompletionProgress,
  formatDaysLeft,
  formatTargetCompletionDate,
  getJobStatusDisplay,
  getPriorityDisplay,
} from "@/lib/job-management";
import { cn } from "@/lib/utils";

export type DashboardJob = {
  id: string;
  title: string;
  customerName: string | null;
  address: string | null;
  jobNumber: string | null;
  poNumber: string | null;
  contractNumber: string | null;
  status: string;
  priority: number;
  targetCompletionDate: Date | string | null;
  createdAt: Date | string;
};

type Props = {
  job: DashboardJob;
  now?: Date;
};

export function DashboardJobCard({ job, now = new Date() }: Props) {
  const status = getJobStatusDisplay(job.status);
  const priority = getPriorityDisplay(job.priority);
  const progress = calculateCompletionProgress({
    createdAt: job.createdAt,
    targetCompletionDate: job.targetCompletionDate,
    now,
  });
  const daysLeft = formatDaysLeft(job.targetCompletionDate, now);
  const targetDateLabel = formatTargetCompletionDate(job.targetCompletionDate);
  const identifiers = [job.jobNumber, job.poNumber, job.contractNumber].filter(Boolean).join(" / ");

  return (
    <Link href={`/jobs/${job.id}`} className="block group" aria-label={`${job.title} job folder`}>
      <Card
        className={cn(
          "h-full min-h-[220px] justify-between relative border transition-all duration-300",
          status.borderClassName,
          status.isGlowing && "shadow-[0_0_24px_rgba(139,92,246,0.35),0_0_36px_rgba(59,130,246,0.25),0_0_44px_rgba(16,185,129,0.18)]",
        )}
      >
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-3 mb-2">
            <h3 className="text-xl font-bold text-white group-hover:text-brand-light transition-colors">
              {job.title}
            </h3>
            {priority.isCritical && (
              <span className="inline-flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-red-300">
                <AlertTriangle size={12} />
                Critical
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 mb-5">
            <span className={cn("text-[10px] font-bold uppercase tracking-widest", status.textClassName)}>
              {status.label}
            </span>
            {job.targetCompletionDate && (
              <>
                <span className="text-zinc-600">•</span>
                <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest text-zinc-500">
                  <CalendarDays size={12} />
                  {targetDateLabel}
                </span>
              </>
            )}
          </div>

          {job.customerName && (
            <p className="text-sm text-zinc-400 flex items-start gap-2">
              <MapPin size={14} className="text-zinc-600 mt-0.5 shrink-0" />
              <span>{job.customerName}{job.address ? ` - ${job.address}` : ""}</span>
            </p>
          )}
          {identifiers && <p className="mt-3 text-xs text-zinc-500">{identifiers}</p>}
        </CardContent>

        <CardFooter className="px-6 py-4 mt-auto border-t border-white/5 bg-transparent flex flex-col gap-3">
          <div className="flex justify-between items-center w-full gap-3">
            <span className="text-xs text-zinc-500 font-medium">{priority.label}</span>
            {progress && <span className={cn("text-xs font-bold", progress.textClassName)}>{progress.percent}%</span>}
          </div>

          {progress && (
            <div className="space-y-2">
              <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className={cn("h-full rounded-full shadow-[0_0_15px_currentColor]", progress.barClassName)}
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
              {daysLeft && <p className="text-xs text-zinc-500">{daysLeft}</p>}
            </div>
          )}
        </CardFooter>
      </Card>
    </Link>
  );
}
