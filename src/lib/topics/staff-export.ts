import { asc, eq, inArray } from "drizzle-orm";

import {
  claimEvidenceLinks,
  claimReviews,
  claims,
  contentRevisions,
  evidenceReviews,
  evidenceSubmissions,
  topics,
} from "@/db/schema";
import type { AdapterResult } from "@/lib/adapters/types";
import { appendAuthAudit } from "@/lib/auth/audit-log";
import { authorizeCapability } from "@/lib/authz/authorize-capability";
import { loadPrincipal } from "@/lib/authz/load-principal";
import { assertEnvironmentSafe } from "@/lib/env/app-mode";
import type { GatedDb } from "@/lib/persistence/gated";
import { validateSourceUrl } from "@/lib/security/source-url";

export type StaffTopicExportBundle = {
  exportedAt: string;
  topic: {
    id: string;
    slug: string;
    title: string;
    question: string;
    background: string;
    scope: string;
    workflowState: string;
    publicationStatus: string;
    jurisdictionLevel: string;
    stateCode: string;
    countyFips: string | null;
    publishedAt: string | null;
  };
  claims: Array<{
    id: string;
    title: string;
    summary: string;
    approachLabel: string;
    workflowState: string;
    moderationVisibility: string;
    updatedAt: string;
  }>;
  evidence: Array<{
    id: string;
    title: string;
    organization: string;
    authorType: string;
    sourceType: string;
    limitations: string;
    sourceUrl: string;
    workflowState: string;
    qualityStatus: string;
    moderationVisibility: string;
    updatedAt: string;
  }>;
  links: Array<{
    id: string;
    claimId: string;
    evidenceSubmissionId: string;
    relationship: string;
  }>;
  publicRationales: Array<{
    subjectKind: "claim" | "evidence";
    subjectId: string;
    decision: string;
    publicRationale: string;
    decidedAt: string;
  }>;
  revisionSummaries: Array<{
    subjectKind: "claim" | "evidence";
    subjectId: string;
    revisionNumber: number;
    changedFieldLabels: string[];
    createdAt: string;
  }>;
  notice: string;
};

function sanitizeExportFilename(slug: string): string {
  const cleaned = slug
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  return `ostt-topic-export-${cleaned || "topic"}.json`;
}

export function staffTopicExportFilename(slug: string): string {
  return sanitizeExportFilename(slug);
}

/**
 * Allowlisted staff topic package. Omits account IDs, contacts, verification,
 * invites, pseudonyms, raw audit, private disclosure, and private notes.
 * Revalidates source URLs; never fetches remotes.
 */
export async function exportStaffTopicPackage(
  db: GatedDb,
  actorAccountId: string,
  topicId: string,
): Promise<
  AdapterResult<{ bundle: StaffTopicExportBundle; filename: string }>
> {
  if (assertEnvironmentSafe() !== "gated") {
    return {
      ok: false,
      error: "Staff topic export unavailable in public-demo mode",
      code: "PUBLIC_DEMO_NO_STAFF_EXPORT",
    };
  }

  const principal = await loadPrincipal(db, actorAccountId);
  const decision = await authorizeCapability(
    db,
    principal,
    "topics.export_staff",
  );
  if (!decision.ok) {
    // Generic not-found style denial to reduce topic enumeration.
    return {
      ok: false,
      error: "Topic not found",
      code: "TOPIC_NOT_FOUND",
    };
  }

  const [topic] = await db
    .select()
    .from(topics)
    .where(eq(topics.id, topicId))
    .limit(1);
  if (!topic) {
    return {
      ok: false,
      error: "Topic not found",
      code: "TOPIC_NOT_FOUND",
    };
  }

  const claimRows = await db
    .select({
      id: claims.id,
      title: claims.title,
      summary: claims.summary,
      approachLabel: claims.approachLabel,
      workflowState: claims.workflowState,
      moderationVisibility: claims.moderationVisibility,
      updatedAt: claims.updatedAt,
    })
    .from(claims)
    .where(eq(claims.topicId, topicId))
    .orderBy(asc(claims.id));

  const evidenceRows = await db
    .select({
      id: evidenceSubmissions.id,
      title: evidenceSubmissions.title,
      organization: evidenceSubmissions.organization,
      authorType: evidenceSubmissions.authorType,
      sourceType: evidenceSubmissions.sourceType,
      limitations: evidenceSubmissions.limitations,
      sourceUrl: evidenceSubmissions.sourceUrl,
      workflowState: evidenceSubmissions.workflowState,
      qualityStatus: evidenceSubmissions.qualityStatus,
      moderationVisibility: evidenceSubmissions.moderationVisibility,
      updatedAt: evidenceSubmissions.updatedAt,
    })
    .from(evidenceSubmissions)
    .where(eq(evidenceSubmissions.topicId, topicId))
    .orderBy(asc(evidenceSubmissions.id));

  const safeEvidence: StaffTopicExportBundle["evidence"] = [];
  for (const row of evidenceRows) {
    const validated = validateSourceUrl(row.sourceUrl);
    if (!validated.ok) {
      // Fail closed for unsafe URLs — omit the URL string entirely.
      safeEvidence.push({
        id: row.id,
        title: row.title,
        organization: row.organization,
        authorType: row.authorType,
        sourceType: row.sourceType,
        limitations: row.limitations,
        sourceUrl: "",
        workflowState: row.workflowState,
        qualityStatus: row.qualityStatus,
        moderationVisibility: row.moderationVisibility,
        updatedAt: row.updatedAt.toISOString(),
      });
      continue;
    }
    safeEvidence.push({
      id: row.id,
      title: row.title,
      organization: row.organization,
      authorType: row.authorType,
      sourceType: row.sourceType,
      limitations: row.limitations,
      sourceUrl: validated.canonicalUrl,
      workflowState: row.workflowState,
      qualityStatus: row.qualityStatus,
      moderationVisibility: row.moderationVisibility,
      updatedAt: row.updatedAt.toISOString(),
    });
  }

  const linkRows = await db
    .select({
      id: claimEvidenceLinks.id,
      claimId: claimEvidenceLinks.claimId,
      evidenceSubmissionId: claimEvidenceLinks.evidenceSubmissionId,
      relationship: claimEvidenceLinks.relationship,
    })
    .from(claimEvidenceLinks)
    .where(eq(claimEvidenceLinks.topicId, topicId))
    .orderBy(asc(claimEvidenceLinks.id));

  const claimIds = claimRows.map((row) => row.id);
  const evidenceIds = evidenceRows.map((row) => row.id);

  const publicRationales: StaffTopicExportBundle["publicRationales"] = [];

  if (claimIds.length > 0) {
    const claimReviewRows = await db
      .select({
        claimId: claimReviews.claimId,
        decision: claimReviews.decision,
        publicRationale: claimReviews.publicRationale,
        decidedAt: claimReviews.decidedAt,
      })
      .from(claimReviews)
      .where(inArray(claimReviews.claimId, claimIds))
      .orderBy(asc(claimReviews.decidedAt));
    for (const row of claimReviewRows) {
      publicRationales.push({
        subjectKind: "claim",
        subjectId: row.claimId,
        decision: row.decision,
        publicRationale: row.publicRationale,
        decidedAt: row.decidedAt.toISOString(),
      });
    }
  }

  if (evidenceIds.length > 0) {
    const evidenceReviewRows = await db
      .select({
        evidenceSubmissionId: evidenceReviews.evidenceSubmissionId,
        decision: evidenceReviews.decision,
        publicRationale: evidenceReviews.publicRationale,
        decidedAt: evidenceReviews.decidedAt,
      })
      .from(evidenceReviews)
      .where(inArray(evidenceReviews.evidenceSubmissionId, evidenceIds))
      .orderBy(asc(evidenceReviews.decidedAt));
    for (const row of evidenceReviewRows) {
      publicRationales.push({
        subjectKind: "evidence",
        subjectId: row.evidenceSubmissionId,
        decision: row.decision,
        publicRationale: row.publicRationale,
        decidedAt: row.decidedAt.toISOString(),
      });
    }
  }

  const revisionSummaries: StaffTopicExportBundle["revisionSummaries"] = [];
  const revisionRows = await db
    .select({
      claimId: contentRevisions.claimId,
      evidenceSubmissionId: contentRevisions.evidenceSubmissionId,
      revisionNumber: contentRevisions.revisionNumber,
      changedFields: contentRevisions.changedFields,
      createdAt: contentRevisions.createdAt,
    })
    .from(contentRevisions)
    .where(eq(contentRevisions.topicId, topicId))
    .orderBy(asc(contentRevisions.createdAt));

  for (const row of revisionRows) {
    if (row.claimId) {
      revisionSummaries.push({
        subjectKind: "claim",
        subjectId: row.claimId,
        revisionNumber: row.revisionNumber,
        changedFieldLabels: row.changedFields,
        createdAt: row.createdAt.toISOString(),
      });
    } else if (row.evidenceSubmissionId) {
      revisionSummaries.push({
        subjectKind: "evidence",
        subjectId: row.evidenceSubmissionId,
        revisionNumber: row.revisionNumber,
        changedFieldLabels: row.changedFields,
        createdAt: row.createdAt.toISOString(),
      });
    }
  }

  const bundle: StaffTopicExportBundle = {
    exportedAt: new Date().toISOString(),
    topic: {
      id: topic.id,
      slug: topic.slug,
      title: topic.title,
      question: topic.question,
      background: topic.background,
      scope: topic.scope,
      workflowState: topic.workflowState,
      publicationStatus: topic.publicationStatus,
      jurisdictionLevel: topic.jurisdictionLevel,
      stateCode: topic.stateCode,
      countyFips: topic.countyFips,
      publishedAt: topic.publishedAt?.toISOString() ?? null,
    },
    claims: claimRows.map((row) => ({
      id: row.id,
      title: row.title,
      summary: row.summary,
      approachLabel: row.approachLabel,
      workflowState: row.workflowState,
      moderationVisibility: row.moderationVisibility,
      updatedAt: row.updatedAt.toISOString(),
    })),
    evidence: safeEvidence,
    links: linkRows.map((row) => ({
      id: row.id,
      claimId: row.claimId,
      evidenceSubmissionId: row.evidenceSubmissionId,
      relationship: row.relationship,
    })),
    publicRationales,
    revisionSummaries,
    notice:
      "Staff topic package (allowlisted). Omits account IDs, contacts, verification, invites, privileged pseudonym mappings, raw audit payloads, private disclosure detail, and private review/moderation notes.",
  };

  // Redaction sentinel — abort if prohibited fields slipped into the projector.
  const blob = JSON.stringify(bundle);
  const prohibited = [
    "authorAccountId",
    "submitterAccountId",
    "createdByAccountId",
    "publishedByAccountId",
    "editorAccountId",
    "reviewerAccountId",
    "actorAccountId",
    "disclosingAccountId",
    "contactChannel",
    "privateDetail",
    "privateNote",
    "privateNotes",
    "beforeSnapshot",
    "afterSnapshot",
  ];
  for (const key of prohibited) {
    if (blob.includes(`"${key}"`)) {
      return {
        ok: false,
        error: "Staff export aborted — prohibited field detected",
        code: "STAFF_EXPORT_REDACTION_BLOCKED",
      };
    }
  }
  if (/account-ostt-/i.test(blob)) {
    return {
      ok: false,
      error: "Staff export aborted — account identifier detected",
      code: "STAFF_EXPORT_REDACTION_BLOCKED",
    };
  }

  await appendAuthAudit(db, {
    actorRole: decision.principal.platformRoles.includes("administrator")
      ? "administrator"
      : "reviewer",
    actorAccountId: decision.principal.accountId,
    action: "topics.staff_export_generated",
    subjectType: "topic",
    subjectId: topic.id,
    summary: "Staff topic package export generated.",
    privatePayload: {
      topicId: topic.id,
      capability: "topics.export_staff",
      actorAccountId: decision.principal.accountId,
      counts: {
        claims: bundle.claims.length,
        evidence: bundle.evidence.length,
        links: bundle.links.length,
        revisions: bundle.revisionSummaries.length,
      },
    },
    synthetic: decision.principal.synthetic,
  });

  return {
    ok: true,
    value: {
      bundle,
      filename: staffTopicExportFilename(topic.slug),
    },
  };
}
