import { describe, expect, it } from "vitest";
import { mapWithConcurrency } from "./async-pool";

describe("mapWithConcurrency", () => {
  it("preserves input order regardless of completion order", async () => {
    const delays = [30, 5, 20, 1, 10];
    const result = await mapWithConcurrency(delays, 2, async (ms, index) => {
      await new Promise((resolve) => setTimeout(resolve, ms));
      return `${index}:${ms}`;
    });

    expect(result).toEqual(["0:30", "1:5", "2:20", "3:1", "4:10"]);
  });

  it("never runs more than `limit` tasks at once", async () => {
    let inFlight = 0;
    let maxInFlight = 0;

    await mapWithConcurrency([...Array(10).keys()], 3, async () => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight--;
    });

    expect(maxInFlight).toBeLessThanOrEqual(3);
    expect(maxInFlight).toBeGreaterThan(1);
  });

  it("passes the index to the mapper", async () => {
    const seen: number[] = [];
    await mapWithConcurrency(["a", "b", "c"], 2, async (_item, index) => {
      seen.push(index);
    });

    expect(seen.sort()).toEqual([0, 1, 2]);
  });

  it("returns an empty array for empty input without invoking the mapper", async () => {
    let called = false;
    const result = await mapWithConcurrency([], 4, async () => {
      called = true;
    });

    expect(result).toEqual([]);
    expect(called).toBe(false);
  });

  it("rejects if any task rejects", async () => {
    await expect(
      mapWithConcurrency([1, 2, 3], 2, async (n) => {
        if (n === 2) throw new Error("boom");
        return n;
      }),
    ).rejects.toThrow("boom");
  });

  it("treats a limit below 1 as sequential", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    await mapWithConcurrency([1, 2, 3], 0, async () => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 1));
      inFlight--;
    });

    expect(maxInFlight).toBe(1);
  });
});
