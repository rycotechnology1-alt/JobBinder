import { format } from "date-fns";
import type { Prisma } from "@prisma/client";

export const JOB_STATUSES = [
  "DESIGN",
  "ACTIVE",
  "DELAY",
  "PUNCH_LIST",
  "FINAL_BILL_SUBMITTED",
  "COMPLETE",
] as const;

export type JobStatusValue = (typeof JOB_STATUSES)[number];
export type PriorityValue = 1 | 2 | 3 | 4;
export type DashboardStatusFilter = "all" | "active" | "delay" | "complete";

export const DASHBOARD_STATUS_FILTERS = ["all", "active", "delay", "complete"] as const;

export type CompletionProgress = {
  percent: number;
  color: "green" | "yellow" | "red";
  barClassName: string;
  textClassName: string;
};

const STATUS_DISPLAY: Record<JobStatusValue, {
  label: string;
  textClassName: string;
  borderClassName: string;
  badgeClassName: string;
  isGlowing?: boolean;
}> = {
  DESIGN: {
    label: "Quoted Only",
    textClassName: "text-red-400",
    borderClassName: "border-red-500/70",
    badgeClassName: "bg-red-500/10 text-red-400 border-red-500/20",
  },
  DELAY: {
    label: "Delayed",
    textClassName: "text-warning",
    borderClassName: "border-warning/70",
    badgeClassName: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  },
  ACTIVE: {
    label: "Work In Progress",
    textClassName: "text-success",
    borderClassName: "border-success/70",
    badgeClassName: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  },
  PUNCH_LIST: {
    label: "Punch List",
    textClassName: "text-brand-light",
    borderClassName: "border-brand/70",
    badgeClassName: "bg-brand/10 text-brand-light border-brand/20",
  },
  FINAL_BILL_SUBMITTED: {
    label: "Final Bill Submitted",
    textClassName: "text-purple-400",
    borderClassName: "border-purple-500/70",
    badgeClassName: "bg-purple-500/10 text-purple-300 border-purple-500/20",
  },
  COMPLETE: {
    label: "Complete Paid",
    textClassName: "text-purple-300",
    borderClassName: "border-emerald-400/70",
    badgeClassName: "bg-purple-500/10 text-purple-200 border-emerald-400/30",
    isGlowing: true,
  },
};

const PRIORITY_DISPLAY: Record<PriorityValue, { label: string; value: PriorityValue; isCritical: boolean }> = {
  1: { label: "Low", value: 1, isCritical: false },
  2: { label: "Medium", value: 2, isCritical: false },
  3: { label: "High", value: 3, isCritical: false },
  4: { label: "Critical", value: 4, isCritical: true },
};

export function getJobStatusDisplay(status: string) {
  return STATUS_DISPLAY[isValidJobStatus(status) ? status : "ACTIVE"];
}

export function isValidJobStatus(status: unknown): status is JobStatusValue {
  return typeof status === "string" && JOB_STATUSES.includes(status as JobStatusValue);
}

export function normalizeDashboardStatusFilter(status: unknown): DashboardStatusFilter {
  return typeof status === "string" && DASHBOARD_STATUS_FILTERS.includes(status as DashboardStatusFilter)
    ? status as DashboardStatusFilter
    : "all";
}

export function normalizeDashboardSearch(search: unknown) {
  if (typeof search !== "string") return "";
  return search.trim();
}

export function getDashboardStatusFilterWhere(status: unknown): Prisma.JobWhereInput {
  const filter = normalizeDashboardStatusFilter(status);

  if (filter === "active") {
    return {
      status: { in: ["DESIGN", "ACTIVE", "PUNCH_LIST", "FINAL_BILL_SUBMITTED"] },
    };
  }

  if (filter === "delay") {
    return { status: "DELAY" };
  }

  if (filter === "complete") {
    return { status: "COMPLETE" };
  }

  return {};
}

export function getDashboardJobSearchWhere(search: unknown): Prisma.JobWhereInput {
  const query = normalizeDashboardSearch(search);
  if (!query) return {};

  return {
    OR: [
      { title: { contains: query, mode: "insensitive" } },
      { customerName: { contains: query, mode: "insensitive" } },
      { poNumber: { contains: query, mode: "insensitive" } },
      { jobNumber: { contains: query, mode: "insensitive" } },
    ],
  };
}

export function getPriorityDisplay(priority: number) {
  const normalized = priority >= 4 ? 4 : priority <= 1 ? 1 : Math.trunc(priority) as PriorityValue;
  return PRIORITY_DISPLAY[isValidPriority(normalized) ? normalized : 3];
}

export function isValidPriority(priority: unknown): priority is PriorityValue {
  return typeof priority === "number" && Number.isInteger(priority) && priority >= 1 && priority <= 4;
}

export function calculateCompletionProgress({
  createdAt,
  targetCompletionDate,
  now = new Date(),
}: {
  createdAt: Date | string;
  targetCompletionDate: Date | string | null;
  now?: Date;
}): CompletionProgress | null {
  if (!targetCompletionDate) return null;

  const createdTime = new Date(createdAt).getTime();
  const targetTime = new Date(targetCompletionDate).getTime();
  const nowTime = now.getTime();
  const duration = targetTime - createdTime;

  if (!Number.isFinite(createdTime) || !Number.isFinite(targetTime) || duration <= 0) {
    return progressDisplay(100);
  }

  const rawPercent = ((nowTime - createdTime) / duration) * 100;
  const clampedPercent = Math.min(100, Math.max(0, rawPercent));
  const percent = Math.floor(clampedPercent / 5) * 5;

  return progressDisplay(percent);
}

export function formatDaysLeft(targetCompletionDate: Date | string | null, now = new Date()) {
  if (!targetCompletionDate) return null;

  const targetTime = new Date(targetCompletionDate).getTime();
  if (!Number.isFinite(targetTime)) return null;

  const dayMs = 24 * 60 * 60 * 1000;
  const days = Math.ceil((targetTime - now.getTime()) / dayMs);

  if (days < 0) return `${Math.abs(days)} ${Math.abs(days) === 1 ? "day" : "days"} overdue`;
  if (days === 0) return "due today";
  return `${days} ${days === 1 ? "day" : "days"} left`;
}

export function formatTargetCompletionDate(targetCompletionDate: Date | string | null) {
  if (!targetCompletionDate) return null;

  const date = new Date(targetCompletionDate);
  if (Number.isNaN(date.getTime())) return null;

  const localDateOnly = new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return format(localDateOnly, "MMM dd, yyyy");
}

export function normalizeOptionalString(value: unknown) {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function normalizeTargetCompletionDate(value: unknown): Date | null | "INVALID_DATE" {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return "INVALID_DATE";

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "INVALID_DATE" : date;
}

function progressDisplay(percent: number): CompletionProgress {
  if (percent <= 30) {
    return {
      percent,
      color: "green",
      barClassName: "bg-success",
      textClassName: "text-success",
    };
  }

  if (percent <= 70) {
    return {
      percent,
      color: "yellow",
      barClassName: "bg-warning",
      textClassName: "text-warning",
    };
  }

  return {
    percent,
    color: "red",
    barClassName: "bg-red-500",
    textClassName: "text-red-400",
  };
}
