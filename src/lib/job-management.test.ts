import { describe, expect, it } from "vitest";
import {
  calculateCompletionProgress,
  formatTargetCompletionDate,
  getJobStatusDisplay,
  getPriorityDisplay,
  isValidJobStatus,
  isValidPriority,
  normalizeOptionalString,
  normalizeTargetCompletionDate,
} from "./job-management";

describe("job management helpers", () => {
  it("maps roadmap status labels and display classes", () => {
    expect(getJobStatusDisplay("DESIGN")).toMatchObject({
      label: "Quoted Only",
      textClassName: "text-red-400",
      borderClassName: "border-red-500/70",
    });
    expect(getJobStatusDisplay("FINAL_BILL_SUBMITTED")).toMatchObject({
      label: "Final Bill Submitted",
      textClassName: "text-purple-400",
      borderClassName: "border-purple-500/70",
    });
    expect(getJobStatusDisplay("COMPLETE")).toMatchObject({
      label: "Complete Paid",
      isGlowing: true,
    });
  });

  it("validates supported job statuses", () => {
    expect(isValidJobStatus("ACTIVE")).toBe(true);
    expect(isValidJobStatus("FINAL_BILL_SUBMITTED")).toBe(true);
    expect(isValidJobStatus("ARCHIVED")).toBe(false);
  });

  it("maps four priority labels and treats legacy priority 5 as critical", () => {
    expect(getPriorityDisplay(1)).toEqual({ label: "Low", value: 1, isCritical: false });
    expect(getPriorityDisplay(4)).toEqual({ label: "Critical", value: 4, isCritical: true });
    expect(getPriorityDisplay(5)).toEqual({ label: "Critical", value: 4, isCritical: true });
  });

  it("validates only the four editable priority values", () => {
    expect(isValidPriority(1)).toBe(true);
    expect(isValidPriority(4)).toBe(true);
    expect(isValidPriority(5)).toBe(false);
  });

  it("calculates elapsed schedule progress in 5 percent chunks", () => {
    const createdAt = new Date("2026-05-10T00:00:00.000Z");
    const targetCompletionDate = new Date("2026-05-20T00:00:00.000Z");
    const now = new Date("2026-05-10T12:00:00.000Z");

    expect(calculateCompletionProgress({ createdAt, targetCompletionDate, now })).toMatchObject({
      percent: 5,
      color: "green",
      barClassName: "bg-success",
    });
  });

  it("returns no progress when no target date is set", () => {
    expect(calculateCompletionProgress({
      createdAt: new Date("2026-05-10T00:00:00.000Z"),
      targetCompletionDate: null,
      now: new Date("2026-05-11T00:00:00.000Z"),
    })).toEqual(null);
  });

  it("clamps completion progress for immediate and overdue targets", () => {
    const createdAt = new Date("2026-05-10T00:00:00.000Z");

    expect(calculateCompletionProgress({
      createdAt,
      targetCompletionDate: createdAt,
      now: createdAt,
    })).toMatchObject({ percent: 100, color: "red" });

    expect(calculateCompletionProgress({
      createdAt,
      targetCompletionDate: new Date("2026-05-11T00:00:00.000Z"),
      now: new Date("2026-05-12T00:00:00.000Z"),
    })).toMatchObject({ percent: 100, color: "red" });
  });

  it("normalizes optional strings and target completion dates for writes", () => {
    expect(normalizeOptionalString("  PO-123  ")).toBe("PO-123");
    expect(normalizeOptionalString("   ")).toBeNull();
    expect(normalizeOptionalString(null)).toBeNull();
    expect(normalizeTargetCompletionDate("2026-05-20")).toEqual(new Date("2026-05-20T00:00:00.000Z"));
    expect(normalizeTargetCompletionDate("not-a-date")).toBe("INVALID_DATE");
  });

  it("formats stored target dates without timezone day drift", () => {
    expect(formatTargetCompletionDate("2026-05-20T00:00:00.000Z")).toBe("May 20, 2026");
  });
});
