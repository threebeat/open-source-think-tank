/**
 * Pure allowlisted public projection for gated published topics (WP 3.6).
 * Unit-testable without React, request, or a live database.
 */

export type PublicGeographyInput = {
  jurisdictionLevel: "statewide" | "county";
  stateCode: string;
  countyFips: string | null;
};

/** Safe public revision summary — never historic bodies or actor IDs. */
export type PublicRevisionSummaryProjection = {
  revisionCount: number;
  latestRevisionAt: string | null;
  changedFieldLabels: string[];
};

export type PublicClaimProjection = {
  title: string;
  summary: string;
  approachLabel: string;
  workflowPublicRationale: string | null;
  conflictPublicSummary: string | null;
  revisionSummary: PublicRevisionSummaryProjection | null;
  evidenceLinks: Array<{
    relationship: "supporting" | "counterevidence";
    evidenceKey: string;
  }>;
};

export type PublicEvidenceProjection = {
  key: string;
  sourceUrl: string;
  title: string;
  organization: string;
  authorType: string;
  sourceType: string;
  limitations: string;
  qualityStatus: "accepted" | "limited" | "disputed" | "rejected";
  qualityPublicRationale: string | null;
  workflowPublicRationale: string | null;
  revisionSummary: PublicRevisionSummaryProjection | null;
};

export type PublicTopicProjection = {
  slug: string;
  title: string;
  question: string;
  background: string;
  scope: string;
  geography: PublicGeographyInput;
  operationalLabel: string;
  publishedAt: string;
  claims: PublicClaimProjection[];
  evidence: PublicEvidenceProjection[];
};

export type ProjectionClaimInput = {
  id: string;
  title: string;
  summary: string;
  approachLabel: string;
  workflowState: string;
  moderationVisibility: string;
  workflowPublicRationale: string | null;
  conflictPublicSummary: string | null;
  revisionSummary: PublicRevisionSummaryProjection | null;
};

export type ProjectionEvidenceInput = {
  id: string;
  sourceUrl: string;
  title: string;
  organization: string;
  authorType: string;
  sourceType: string;
  limitations: string;
  workflowState: string;
  qualityStatus: string;
  moderationVisibility: string;
  qualityPublicRationale: string | null;
  workflowPublicRationale: string | null;
  revisionSummary: PublicRevisionSummaryProjection | null;
};

export type ProjectionLinkInput = {
  topicId: string;
  claimId: string;
  evidenceSubmissionId: string;
  relationship: "supporting" | "counterevidence";
};

export type ProjectionTopicInput = {
  id: string;
  slug: string;
  title: string;
  question: string;
  background: string;
  scope: string;
  workflowState: string;
  publicationStatus: string;
  jurisdictionLevel: "statewide" | "county";
  stateCode: string;
  countyFips: string | null;
  publishedAt: Date | string | null;
};

export type BuildPublicTopicProjectionInput = {
  topic: ProjectionTopicInput;
  claims: ProjectionClaimInput[];
  evidence: ProjectionEvidenceInput[];
  links: ProjectionLinkInput[];
};

function isPublishableHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function operationalLabelFor(workflowState: string): string {
  switch (workflowState) {
    case "under_review":
      return "Under review (operational)";
    case "open_for_submissions":
      return "Open for submissions (operational)";
    case "paused":
      return "Paused (operational)";
    case "archived":
      return "Archived (operational)";
    case "draft":
      return "Draft (operational)";
    default:
      return "Operational status recorded";
  }
}

function toIso(publishedAt: Date | string | null): string | null {
  if (!publishedAt) return null;
  if (typeof publishedAt === "string") return publishedAt;
  return publishedAt.toISOString();
}

function isNonPendingQuality(
  status: string,
): status is "accepted" | "limited" | "disputed" | "rejected" {
  return (
    status === "accepted" ||
    status === "limited" ||
    status === "disputed" ||
    status === "rejected"
  );
}

/**
 * Build a visitor-safe DTO. Returns null when the topic or content set is not
 * publishable under 3.6 rules (defense in depth beyond repository filters).
 */
export function buildPublicTopicProjection(
  input: BuildPublicTopicProjectionInput,
): PublicTopicProjection | null {
  const { topic } = input;
  if (topic.publicationStatus !== "published") {
    return null;
  }
  const publishedAt = toIso(topic.publishedAt);
  if (!publishedAt) {
    return null;
  }

  const evidenceById = new Map(input.evidence.map((row) => [row.id, row]));
  const publicKeyByEvidenceId = new Map<string, string>();
  const evidenceOut: PublicEvidenceProjection[] = [];
  const claims: PublicClaimProjection[] = [];

  function publicKeyFor(evidenceId: string): string {
    const existing = publicKeyByEvidenceId.get(evidenceId);
    if (existing) return existing;
    const key = `ev-${publicKeyByEvidenceId.size + 1}`;
    publicKeyByEvidenceId.set(evidenceId, key);
    return key;
  }

  for (const claim of input.claims) {
    if (
      claim.workflowState !== "accepted" ||
      claim.moderationVisibility !== "visible"
    ) {
      continue;
    }

    const claimLinks = input.links.filter(
      (link) =>
        link.claimId === claim.id &&
        link.topicId === topic.id &&
        (link.relationship === "supporting" ||
          link.relationship === "counterevidence"),
    );

    const publicLinks: PublicClaimProjection["evidenceLinks"] = [];
    for (const link of claimLinks) {
      const evidence = evidenceById.get(link.evidenceSubmissionId);
      if (!evidence) continue;
      if (
        evidence.workflowState !== "accepted" ||
        evidence.moderationVisibility !== "visible"
      ) {
        continue;
      }
      if (!isNonPendingQuality(evidence.qualityStatus)) {
        continue;
      }
      if (!evidence.qualityPublicRationale?.trim()) {
        continue;
      }
      if (!isPublishableHttpUrl(evidence.sourceUrl)) {
        continue;
      }

      const key = publicKeyFor(evidence.id);
      if (!evidenceOut.some((row) => row.key === key)) {
        evidenceOut.push({
          key,
          sourceUrl: evidence.sourceUrl,
          title: evidence.title,
          organization: evidence.organization,
          authorType: evidence.authorType,
          sourceType: evidence.sourceType,
          limitations: evidence.limitations,
          qualityStatus: evidence.qualityStatus,
          qualityPublicRationale: evidence.qualityPublicRationale,
          workflowPublicRationale: evidence.workflowPublicRationale,
          revisionSummary: evidence.revisionSummary,
        });
      }
      publicLinks.push({
        relationship: link.relationship,
        evidenceKey: key,
      });
    }

    if (publicLinks.length === 0) {
      continue;
    }

    claims.push({
      title: claim.title,
      summary: claim.summary,
      approachLabel: claim.approachLabel,
      workflowPublicRationale: claim.workflowPublicRationale,
      conflictPublicSummary: claim.conflictPublicSummary,
      revisionSummary: claim.revisionSummary,
      evidenceLinks: publicLinks,
    });
  }

  if (claims.length === 0 || evidenceOut.length === 0) {
    return null;
  }

  return {
    slug: topic.slug,
    title: topic.title,
    question: topic.question,
    background: topic.background,
    scope: topic.scope,
    geography: {
      jurisdictionLevel: topic.jurisdictionLevel,
      stateCode: topic.stateCode,
      countyFips: topic.countyFips,
    },
    operationalLabel: operationalLabelFor(topic.workflowState),
    publishedAt,
    claims,
    evidence: evidenceOut,
  };
}

/** Leak checklist helper for tests and readiness diagnostics. */
export function projectionContainsForbiddenKeys(
  value: unknown,
  forbiddenSubstrings: string[] = [
    "accountId",
    "AccountId",
    "reviewer",
    "privateNotes",
    "privateDetail",
    "contactChannel",
    "verification",
    "private_detail",
    "private_notes",
    "editorAccountId",
    "beforeSnapshot",
    "afterSnapshot",
    "claimId",
    "evidenceSubmissionId",
    "revisionNumber",
  ],
): string[] {
  const serialized = JSON.stringify(value);
  return forbiddenSubstrings.filter((needle) => serialized.includes(needle));
}
