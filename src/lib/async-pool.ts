/**
 * Runs an async mapper over `items` with at most `limit` operations in flight at
 * once, returning results in the SAME order as the input.
 *
 * Used to keep heavy fan-outs (R2 downloads, markup PDF generation) from
 * spiking peak memory / saturating R2 during a job-package export, while
 * preserving item ordering so downstream filename collision resolution stays
 * deterministic. A `limit` below 1 runs sequentially.
 *
 * Rejects on the first mapper rejection. Callers that need partial success
 * (e.g. skip-and-warn) should handle errors inside the mapper.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  if (items.length === 0) return results;

  const maxInFlight = Math.max(1, Math.min(limit, items.length));
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await mapper(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: maxInFlight }, () => worker()));
  return results;
}
