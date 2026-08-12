import { sql, type SQL, type AnyColumn } from "drizzle-orm";

/**
 * Optimistic-concurrency helpers for expected-`updated_at` writes.
 * Browser tokens are millisecond ISO strings; successful writes must advance
 * the stored token by at least one millisecond.
 *
 * Postgres `timestamptz` may store microseconds from `now()`, while JS/ISO
 * tokens are millisecond-only. Compare via epoch-millis so both PGlite and
 * Postgres honor the same stale-writer contract.
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

/** SQL predicate: column matches expected token at millisecond precision. */
export function updatedAtEqualsMs(
  column: AnyColumn,
  expected: Date,
): SQL {
  return sql`(floor(extract(epoch from ${column}) * 1000)) = ${expected.getTime()}`;
}
