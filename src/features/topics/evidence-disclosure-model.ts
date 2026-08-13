/**
 * Progressive evidence disclosure presentation model (Phase 4.3).
 *
 * Collapsing details is a readability feature — not a confidentiality boundary.
 * Every field must already be filtered through the public projection (or synthetic
 * public-demo fixtures) before mapping into this model.
 */

export type EvidenceDisclosureRelationship =
  | "supporting"
  | "counterevidence"
  | "unlinked";

export type EvidenceDisclosureItem = {
  /** Stable evidence identifier used as React key and optional anchor. */
  id: string;
  title: string;
  relationship: EvidenceDisclosureRelationship;
  relationshipLabel: string;
  qualityLabel: string;
  /** Source organization when present; otherwise a source-type label. */
  sourceOrganizationOrType: string;
  /** Concise public-safe contribution sentence (collapsed). */
  contributionSentence: string;
  /** External source — never shown in the collapsed summary. */
  sourceUrl: string | null;
  sourceLinkTitle: string | null;
  sourceHostname: string | null;
  sourceUnavailableLabel: string | null;
  publishedOn: string | null;
  authorTypeLabel: string | null;
  sourceTypeLabel: string | null;
  qualityRationale: string | null;
  workflowRationale: string | null;
  limitations: string | null;
  conflictSummary: string | null;
  revisionSummaryLabel: string | null;
  moderationNoticeLabel: string | null;
  extendedExplanation: string | null;
  /** Claim titles linked to this source (inventory canonical detail). */
  linkedClaimLabels: string[];
};

export function relationshipLabelFor(
  relationship: EvidenceDisclosureRelationship,
): string {
  switch (relationship) {
    case "supporting":
      return "Supporting";
    case "counterevidence":
      return "Evidence against this claim";
    case "unlinked":
      return "Attached to topic";
  }
}

/** Prefer a useful hostname; never dump a long raw URL into the summary. */
export function sourceHostnameFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

export function sourceLinkTitleFromUrl(url: string | null | undefined): string | null {
  const host = sourceHostnameFromUrl(url);
  if (!host) return null;
  return `Open source at ${host}`;
}
