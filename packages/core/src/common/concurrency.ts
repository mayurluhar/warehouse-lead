/**
 * Bounded-parallelism helper for fan-out over network calls.
 *
 * Scanning now issues dozens of feed requests. Doing them sequentially would
 * blow the Lambda timeout; doing them all at once would open dozens of sockets
 * and invite rate-limiting from the news providers. This runs a fixed number
 * in flight and stops starting new work once the deadline passes, so a scan
 * degrades to fewer sources rather than timing out and returning nothing.
 */
export async function mapWithConcurrency<TIn, TOut>(
  items: TIn[],
  worker: (item: TIn, index: number) => Promise<TOut>,
  options: { concurrency: number; deadlineAt?: number }
): Promise<TOut[]> {
  const results: TOut[] = [];
  let cursor = 0;

  const runners = Array.from({ length: Math.max(1, Math.min(options.concurrency, items.length)) }, async () => {
    while (cursor < items.length) {
      if (options.deadlineAt !== undefined && Date.now() >= options.deadlineAt) return;
      const index = cursor++;
      results.push(await worker(items[index], index));
    }
  });

  await Promise.all(runners);
  return results;
}
