/**
 * Optimistic-concurrency helpers for expected-`updated_at` writes.
 * Browser tokens are millisecond ISO strings; successful writes must advance
 * the stored token by at least one millisecond.
 */

/** Next `updated_at` that is strictly newer than `previous` by ≥1 ms. */
export function nextUpdatedAt(previous: Date, now = new Date()): Date {
  const minNext = previous.getTime() + 1;
  return new Date(Math.max(now.getTime(), minNext));
}

/** Truncate to millisecond precision for stable SQL/JS token comparison. */
export function truncateToMillisecond(value: Date): Date {
  return new Date(value.getTime());
}
