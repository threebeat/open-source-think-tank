/**
 * Deterministic public date/time presentation for gated visitor surfaces.
 * Always renders America/Chicago with an explicit timezone abbreviation.
 */

const PUBLIC_DATE_TIME_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Chicago",
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZoneName: "short",
});

/** Format an ISO timestamp for public visitor UI. */
export function formatPublicDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }
  return PUBLIC_DATE_TIME_FORMATTER.format(date);
}
