/** Placeholders must not become published assent documents (2.6). */
export const NOT_LEGALLY_REVIEWED_MARKER = /not\s+legally\s+reviewed/i;

export function containsNotLegallyReviewedMarker(...parts: string[]): boolean {
  return parts.some((part) => NOT_LEGALLY_REVIEWED_MARKER.test(part));
}
