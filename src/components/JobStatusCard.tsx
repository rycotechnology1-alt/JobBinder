"use client";

import type React from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Pencil, Save } from "lucide-react";
import { JOB_STATUSES, formatTargetCompletionDate, getJobStatusDisplay, getPriorityDisplay } from "@/lib/job-management";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";

type StatusJob = {
  id: string;
  status: string;
  priority: number;
  targetCompletionDate: string | null;
};

type Props = {
  job: StatusJob;
  isAdmin: boolean;
};

export function JobStatusCard({ job, isAdmin }: Props) {
  const [status, setStatus] = useState(job.status);
  const [priority, setPriority] = useState(String(getPriorityDisplay(job.priority).value));
  const [targetCompletionDate, setTargetCompletionDate] = useState(job.targetCompletionDate?.slice(0, 10) ?? "");
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const statusDisplay = getJobStatusDisplay(status);
  const priorityDisplay = getPriorityDisplay(Number(priority));
  const targetDateLabel = formatTargetCompletionDate(targetCompletionDate || job.targetCompletionDate) ?? "No target date";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/jobs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: job.id,
          status,
          priority: Number(priority),
          targetCompletionDate,
        }),
      });

      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error || "Could not update status.");
      }

      router.refresh();
      setIsEditing(false);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Could not update status.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className={cn("border", statusDisplay.borderClassName)}>
      <CardContent className="p-4">
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-zinc-50">Project Status</h2>
              <div className="mt-3 grid grid-cols-1 gap-2 text-sm">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Status</p>
                  <p className={cn("text-sm font-bold", statusDisplay.textClassName)}>{statusDisplay.label}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Priority</p>
                    <p className="text-sm font-medium text-zinc-200">{priorityDisplay.label}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Target</p>
                    <p className="text-sm font-medium text-zinc-200">{targetDateLabel}</p>
                  </div>
                </div>
              </div>
            </div>
            {isAdmin ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label="Edit project status"
                onClick={() => setIsEditing((current) => !current)}
              >
                <Pencil size={16} />
              </Button>
            ) : (
              <CalendarDays size={18} className="mt-1 text-zinc-500" />
            )}
          </div>

          {isAdmin && isEditing && (
            <form onSubmit={handleSubmit} className="space-y-4 border-t border-zinc-800 pt-4">
              <div>
                <label htmlFor="quick-status" className="block text-sm font-medium text-zinc-400 mb-1">Status</label>
                <select
                  id="quick-status"
                  name="status"
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                  className="h-11 w-full rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 text-sm text-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  {JOB_STATUSES.map((jobStatus) => (
                    <option key={jobStatus} value={jobStatus}>{getJobStatusDisplay(jobStatus).label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="quick-priority" className="block text-sm font-medium text-zinc-400 mb-1">Priority</label>
                <select
                  id="quick-priority"
                  name="priority"
                  value={priority}
                  onChange={(event) => setPriority(event.target.value)}
                  className="h-11 w-full rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 text-sm text-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  {[1, 2, 3, 4].map((priorityValue) => (
                    <option key={priorityValue} value={priorityValue}>{getPriorityDisplay(priorityValue).label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="quick-target-date" className="block text-sm font-medium text-zinc-400 mb-1">Target Completion</label>
                <Input
                  id="quick-target-date"
                  name="targetCompletionDate"
                  type="date"
                  value={targetCompletionDate}
                  onChange={(event) => setTargetCompletionDate(event.target.value)}
                />
              </div>

              {error && <p className="text-sm text-red-400">{error}</p>}

              <Button type="submit" variant="secondary" className="w-full gap-2" disabled={isSubmitting}>
                <Save size={16} />
                {isSubmitting ? "Saving..." : "Save Status"}
              </Button>
            </form>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
