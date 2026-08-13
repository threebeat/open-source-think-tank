import type { Claim, EvidenceSource } from "@/domain/types";
import {
  authorTypeLabels,
  evidenceReviewExplanations,
  evidenceReviewLabels,
  sourceTypeLabels,
} from "@/lib/evidence-labels";
import type { PublicTopicProjection } from "@/lib/topics/public-projection";
import {
  relationshipLabelFor,
  sourceHostnameFromUrl,
  sourceLinkTitleFromUrl,
  type EvidenceDisclosureItem,
  type EvidenceDisclosureRelationship,
} from "@/features/topics/evidence-disclosure-model";

function qualityPlainLanguage(
  status: "accepted" | "limited" | "disputed",
): string {
  switch (status) {
    case "accepted":
      return "Accepted quality means reviewers found the source usable for this alpha publication. It does not prove a claim is true.";
    case "limited":
      return "Limited quality means the source is useful with clear constraints. It does not prove a claim is true.";
    case "disputed":
      return "Disputed quality means reviewers recorded contested source fitness. It does not prove a claim is true or false.";
  }
}

export function mapFixtureEvidenceToDisclosure(input: {
  source: EvidenceSource;
  relationship: EvidenceDisclosureRelationship;
  linkedClaims?: Claim[];
}): EvidenceDisclosureItem {
  const { source, relationship, linkedClaims = [] } = input;
  return {
    id: source.id,
    title: source.title,
    relationship,
    relationshipLabel: relationshipLabelFor(relationship),
    qualityLabel: `Review: ${evidenceReviewLabels[source.reviewStatus]}`,
    sourceOrganizationOrType: source.organization || sourceTypeLabels[source.sourceType],
    contributionSentence: source.summary,
    sourceUrl: null,
    sourceLinkTitle: null,
    sourceHostname: null,
    sourceUnavailableLabel:
      "Synthetic demo sources do not expose a live external URL.",
    publishedOn: source.publishedOn,
    authorTypeLabel: authorTypeLabels[source.authorType],
    sourceTypeLabel: sourceTypeLabels[source.sourceType],
    qualityRationale: null,
    workflowRationale: null,
    limitations: source.limitations,
    conflictSummary: source.conflicts,
    revisionSummaryLabel: null,
    moderationNoticeLabel: null,
    extendedExplanation: evidenceReviewExplanations[source.reviewStatus],
    linkedClaimLabels: linkedClaims.map((claim) => claim.title),
  };
}

export function mapPublicEvidenceToDisclosure(input: {
  evidence: PublicTopicProjection["evidence"][number];
  relationship: EvidenceDisclosureRelationship;
  linkedClaimTitles?: string[];
}): EvidenceDisclosureItem {
  const { evidence, relationship, linkedClaimTitles = [] } = input;
  const sourceUrl = evidence.sourceUrl;
  const revision = evidence.revisionSummary;
  const restoration = evidence.latestRestorationNotice;

  return {
    id: evidence.key,
    title: evidence.title,
    relationship,
    relationshipLabel: relationshipLabelFor(relationship),
    qualityLabel: `Evidence quality: ${evidence.qualityStatus.replaceAll("_", " ")}`,
    sourceOrganizationOrType:
      evidence.organization || evidence.sourceType || "Source",
    contributionSentence: qualityPlainLanguage(evidence.qualityStatus),
    sourceUrl,
    sourceLinkTitle: sourceLinkTitleFromUrl(sourceUrl),
    sourceHostname: sourceHostnameFromUrl(sourceUrl),
    sourceUnavailableLabel: sourceUrl
      ? null
      : "Source link unavailable or redacted in this projection.",
    publishedOn: null,
    authorTypeLabel: evidence.authorType,
    sourceTypeLabel: evidence.sourceType,
    qualityRationale: evidence.qualityPublicRationale,
    workflowRationale: evidence.workflowPublicRationale,
    limitations: evidence.limitations,
    conflictSummary: evidence.conflictPublicSummary,
    revisionSummaryLabel: revision
      ? `${revision.revisionCount} revision(s)` +
        (revision.latestRevisionAt
          ? `; latest ${revision.latestRevisionAt}`
          : "") +
        (revision.changedFieldLabels.length
          ? `; fields: ${revision.changedFieldLabels.join(", ")}`
          : "")
      : null,
    moderationNoticeLabel: restoration
      ? `${restoration.action}: ${restoration.publicRationale}`
      : null,
    extendedExplanation: null,
    linkedClaimLabels: linkedClaimTitles,
  };
}

/** Prefer a single primary relationship when a source appears under multiple claims. */
export function primaryRelationshipForFixtureSource(
  sourceId: string,
  claims: Claim[],
): EvidenceDisclosureRelationship {
  let supporting = false;
  let counter = false;
  for (const claim of claims) {
    if (claim.supportingEvidenceIds.includes(sourceId)) supporting = true;
    if (claim.counterEvidenceIds.includes(sourceId)) counter = true;
  }
  if (supporting && !counter) return "supporting";
  if (counter && !supporting) return "counterevidence";
  if (supporting && counter) return "supporting";
  return "unlinked";
}

export function linkedClaimsForFixtureSource(
  sourceId: string,
  claims: Claim[],
): Claim[] {
  return claims.filter(
    (claim) =>
      claim.supportingEvidenceIds.includes(sourceId) ||
      claim.counterEvidenceIds.includes(sourceId),
  );
}

export function primaryRelationshipForPublicEvidence(
  evidenceKey: string,
  claims: PublicTopicProjection["claims"],
): EvidenceDisclosureRelationship {
  let supporting = false;
  let counter = false;
  for (const claim of claims) {
    for (const link of claim.evidenceLinks) {
      if (link.evidenceKey !== evidenceKey) continue;
      if (link.relationship === "supporting") supporting = true;
      if (link.relationship === "counterevidence") counter = true;
    }
  }
  if (supporting && !counter) return "supporting";
  if (counter && !supporting) return "counterevidence";
  if (supporting && counter) return "supporting";
  return "unlinked";
}

export function linkedClaimTitlesForPublicEvidence(
  evidenceKey: string,
  claims: PublicTopicProjection["claims"],
): string[] {
  return claims
    .filter((claim) =>
      claim.evidenceLinks.some((link) => link.evidenceKey === evidenceKey),
    )
    .map((claim) => claim.title);
}
