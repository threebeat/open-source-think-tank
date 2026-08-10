/**
 * Content scanners for public projections — check values, not just JSON keys.
 */

const SENSITIVE_VALUE_PATTERNS: RegExp[] = [
  /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i,
  /\bostt:vhold:[A-Za-z0-9_-]+\b/i,
  /\bostt:purged:[A-Za-z0-9_-]+\b/i,
  /\baccount-[a-z0-9-]+\b/i,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9._-]+\b/,
  /\bBearer\s+[A-Za-z0-9._\-+/=]+\b/i,
  /\b(political[- ]?opinion|vote[- ]?choice|ideology)\b/i,
];

export function findSensitivePublicContent(value: unknown): string | null {
  if (value == null) {
    return null;
  }
  if (typeof value === "string") {
    for (const pattern of SENSITIVE_VALUE_PATTERNS) {
      if (pattern.test(value)) {
        return value.slice(0, 120);
      }
    }
    return null;
  }
  if (typeof value === "object") {
    for (const nested of Object.values(value as Record<string, unknown>)) {
      const hit = findSensitivePublicContent(nested);
      if (hit) {
        return hit;
      }
    }
  }
  return null;
}

/** Scan human-facing public fields only (not continuity digests). */
export function assertNoSensitivePublicContent(projection: {
  summary: string;
  action?: string;
  subjectType?: string;
}): void {
  const hit = findSensitivePublicContent({
    summary: projection.summary,
    action: projection.action,
    subjectType: projection.subjectType,
  });
  if (hit) {
    throw new Error(
      `Public audit projection contains sensitive content: ${hit}`,
    );
  }
}
