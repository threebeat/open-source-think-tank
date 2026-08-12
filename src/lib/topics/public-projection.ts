import { isAllowedSourceUrl } from "@/lib/security/source-url";

/**
 * Pure allowlisted public projection for gated published topics (WP 3.6 / 3.10).
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

/** Allowlisted public moderation notice — never private notes or withheld bodies. */
export type PublicModerationNoticeProjection = {
  subjectKind: "claim" | "evidence";
  action: "hold" | "hide" | "restore";
  publicRationale: string;
  recordedAt: string;
};

export type PublicClaimProjection = {
  title: string;
  summary: string;
  approachLabel: string;
  workflowPublicRationale: string | null;
  conflictPublicSummary: string | null;
  revisionSummary: PublicRevisionSummaryProjection | null;
  /** Present only for currently included visible claims that were restored. */
  latestRestorationNotice: PublicModerationNoticeProjection | null;
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
  qualityStatus: "accepted" | "limited" | "disputed";
  qualityPublicRationale: string | null;
  workflowPublicRationale: string | null;
  conflictPublicSummary: string | null;
  revisionSummary: PublicRevisionSummaryProjection | null;
  /** Present only for currently included visible evidence that was restored. */
  latestRestorationNotice: PublicModerationNoticeProjection | null;
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
  /**
   * Notices that accepted content was withheld from this publication.
   * Contain action, public rationale, and date only — no titles/bodies/URLs/IDs.
   */
  withheldModerationNotices: PublicModerationNoticeProjection[];
};

export type ProjectionModerationNoticeInput = {
  action: "hold" | "hide" | "restore";
  publicRationale: string;
  recordedAt: Date | string;
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
  /** Latest moderation action for this claim, if any. */
  latestModerationNotice: ProjectionModerationNoticeInput | null;
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
  conflictPublicSummary: string | null;
  revisionSummary: PublicRevisionSummaryProjection | null;
  latestModerationNotice: ProjectionModerationNoticeInput | null;
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

/** Publicly eligible evidence-quality states for readiness and projection. */
export function isPublicEligibleEvidenceQuality(
  status: string,
): status is "accepted" | "limited" | "disputed" {
  return (
    status === "accepted" || status === "limited" || status === "disputed"
  );
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

function toNotice(
  subjectKind: "claim" | "evidence",
  notice: ProjectionModerationNoticeInput,
): PublicModerationNoticeProjection {
  return {
    subjectKind,
    action: notice.action,
    publicRationale: notice.publicRationale,
    recordedAt: toIso(notice.recordedAt) ?? "",
  };
}

function compareStrings(a: string, b: string): number {
  return a.localeCompare(b, "en", { sensitivity: "base" });
}

function compareClaims(a: ProjectionClaimInput, b: ProjectionClaimInput): number {
  return (
    compareStrings(a.title, b.title) ||
    compareStrings(a.approachLabel, b.approachLabel) ||
    compareStrings(a.summary, b.summary) ||
    compareStrings(a.id, b.id)
  );
}

function compareEvidence(
  a: ProjectionEvidenceInput,
  b: ProjectionEvidenceInput,
): number {
  return (
    compareStrings(a.title, b.title) ||
    compareStrings(a.organization, b.organization) ||
    compareStrings(a.sourceUrl, b.sourceUrl) ||
    compareStrings(a.id, b.id)
  );
}

function compareLinks(
  a: ProjectionLinkInput,
  b: ProjectionLinkInput,
  evidenceById: Map<string, ProjectionEvidenceInput>,
): number {
  const relationshipRank = (value: string) =>
    value === "supporting" ? 0 : value === "counterevidence" ? 1 : 2;
  const byRelationship =
    relationshipRank(a.relationship) - relationshipRank(b.relationship);
  if (byRelationship !== 0) return byRelationship;
  const evidenceA = evidenceById.get(a.evidenceSubmissionId);
  const evidenceB = evidenceById.get(b.evidenceSubmissionId);
  if (evidenceA && evidenceB) {
    return compareEvidence(evidenceA, evidenceB);
  }
  return compareStrings(a.evidenceSubmissionId, b.evidenceSubmissionId);
}

function compareNotices(
  a: PublicModerationNoticeProjection,
  b: PublicModerationNoticeProjection,
): number {
  return (
    compareStrings(a.recordedAt, b.recordedAt) ||
    compareStrings(a.subjectKind, b.subjectKind) ||
    compareStrings(a.action, b.action) ||
    compareStrings(a.publicRationale, b.publicRationale)
  );
}

/**
 * Build a visitor-safe DTO.
 * Returns null only for missing/unpublished (or missing publishedAt) topics.
 * A published topic with no currently eligible claim/evidence remains addressable
 * as an empty published shell (3.10).
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
  const withheldModerationNotices: PublicModerationNoticeProjection[] = [];

  function publicKeyFor(evidenceId: string): string {
    const existing = publicKeyByEvidenceId.get(evidenceId);
    if (existing) return existing;
    const key = `ev-${publicKeyByEvidenceId.size + 1}`;
    publicKeyByEvidenceId.set(evidenceId, key);
    return key;
  }

  function isProjectionEligibleEvidence(
    evidence: ProjectionEvidenceInput,
  ): boolean {
    return (
      evidence.workflowState === "accepted" &&
      isPublicEligibleEvidenceQuality(evidence.qualityStatus) &&
      Boolean(evidence.qualityPublicRationale?.trim()) &&
      isAllowedSourceUrl(evidence.sourceUrl)
    );
  }

  const sortedClaims = [...input.claims].sort(compareClaims);

  for (const claim of sortedClaims) {
    if (claim.workflowState !== "accepted") {
      continue;
    }

    // Withheld accepted claims: expose a safe notice without title/body.
    if (
      claim.moderationVisibility === "held" ||
      claim.moderationVisibility === "hidden"
    ) {
      const notice = claim.latestModerationNotice;
      if (
        notice &&
        (notice.action === "hold" || notice.action === "hide") &&
        notice.publicRationale.trim()
      ) {
        withheldModerationNotices.push(toNotice("claim", notice));
      }
      continue;
    }

    if (claim.moderationVisibility !== "visible") {
      continue;
    }

    const claimLinks = input.links
      .filter(
        (link) =>
          link.claimId === claim.id &&
          link.topicId === topic.id &&
          (link.relationship === "supporting" ||
            link.relationship === "counterevidence"),
      )
      .sort((a, b) => compareLinks(a, b, evidenceById));

    const publicLinks: PublicClaimProjection["evidenceLinks"] = [];
    for (const link of claimLinks) {
      const evidence = evidenceById.get(link.evidenceSubmissionId);
      if (!evidence) continue;
      if (!isProjectionEligibleEvidence(evidence)) {
        continue;
      }
      if (!isPublicEligibleEvidenceQuality(evidence.qualityStatus)) {
        continue;
      }

      if (
        evidence.moderationVisibility === "held" ||
        evidence.moderationVisibility === "hidden"
      ) {
        const notice = evidence.latestModerationNotice;
        if (
          notice &&
          (notice.action === "hold" || notice.action === "hide") &&
          notice.publicRationale.trim()
        ) {
          const already = withheldModerationNotices.some(
            (row) =>
              row.subjectKind === "evidence" &&
              row.recordedAt === (toIso(notice.recordedAt) ?? "") &&
              row.publicRationale === notice.publicRationale &&
              row.action === notice.action,
          );
          if (!already) {
            withheldModerationNotices.push(toNotice("evidence", notice));
          }
        }
        continue;
      }

      if (evidence.moderationVisibility !== "visible") {
        continue;
      }

      const key = publicKeyFor(evidence.id);
      if (!evidenceOut.some((row) => row.key === key)) {
        const restoreNotice =
          evidence.latestModerationNotice?.action === "restore"
            ? toNotice("evidence", evidence.latestModerationNotice)
            : null;
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
          conflictPublicSummary: evidence.conflictPublicSummary,
          revisionSummary: evidence.revisionSummary,
          latestRestorationNotice: restoreNotice,
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

    const restoreNotice =
      claim.latestModerationNotice?.action === "restore"
        ? toNotice("claim", claim.latestModerationNotice)
        : null;

    claims.push({
      title: claim.title,
      summary: claim.summary,
      approachLabel: claim.approachLabel,
      workflowPublicRationale: claim.workflowPublicRationale,
      conflictPublicSummary: claim.conflictPublicSummary,
      revisionSummary: claim.revisionSummary,
      latestRestorationNotice: restoreNotice,
      evidenceLinks: publicLinks,
    });
  }

  withheldModerationNotices.sort(compareNotices);

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
    withheldModerationNotices,
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
