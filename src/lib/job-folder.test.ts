import { describe, expect, it } from "vitest";
import {
  countIncompleteTasks,
  isValidTaskStatus,
  isValidTaskType,
  normalizeFileDisplayName,
} from "./job-folder";

describe("job folder helpers", () => {
  it("normalizes optional file display names", () => {
    expect(normalizeFileDisplayName("  Permit packet  ")).toBe("Permit packet");
    expect(normalizeFileDisplayName("")).toBeNull();
    expect(normalizeFileDisplayName("   ")).toBeNull();
    expect(normalizeFileDisplayName(null)).toBeNull();
  });

  it("validates task enum input before API writes", () => {
    expect(isValidTaskStatus("OPEN")).toBe(true);
    expect(isValidTaskStatus("IN_PROGRESS")).toBe(true);
    expect(isValidTaskStatus("DONE")).toBe(true);
    expect(isValidTaskStatus("ARCHIVED")).toBe(false);

    expect(isValidTaskType("TASK")).toBe(true);
    expect(isValidTaskType("PUNCH_LIST")).toBe(true);
    expect(isValidTaskType("REMINDER")).toBe(false);
  });

  it("counts only incomplete tasks for the task tab badge", () => {
    expect(
      countIncompleteTasks([
        { status: "OPEN" },
        { status: "IN_PROGRESS" },
        { status: "DONE" },
      ]),
    ).toBe(2);
  });
});
