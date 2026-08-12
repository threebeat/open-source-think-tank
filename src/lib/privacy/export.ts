import { asc, eq, inArray, or } from "drizzle-orm";

import {
  accountDeletionRequests,
  accounts,
  assentOutcomes,
  assentRecords,
  claimEvidenceLinks,
  claims,
  conflictDisclosures,
  contentRevisions,
  conversationPseudonyms,
  evidenceSubmissions,
  profiles,
  topics,
  verificationCases,
} from "@/db/schema";
import type { FoundationDb } from "@/db/types";
import type { AdapterResult } from "@/lib/adapters/types";
import { appendAuthAudit } from "@/lib/auth/audit-log";
import { authorizeCapability } from "@/lib/authz/authorize-capability";
import { loadPrincipal } from "@/lib/authz/load-principal";
import { assertEnvironmentSafe } from "@/lib/env/app-mode";
import { operationalSubjectRef, securityLog } from "@/lib/security/log";

export type AccountExportBundle = {
  exportedAt: string;
  accountId: string;
  account: {
    lifecycleState: string;
    synthetic: boolean;
    contactChannel: string;
    activatedAt: string | null;
    closedAt: string | null;
  };
  profile: { preferredDisplayName: string } | null;
  assentRecords: Array<{
    id: string;
    documentVersionId: string;
    method: string;
    createdAt: string;
  }>;
  assentOutcomes: Array<{
    id: string;
    outcome: string;
    createdAt: string;
  }>;
  verificationCases: Array<{
    id: string;
    kind: string;
    status: string;
    decidedAt: string | null;
  }>;
  conversationPseudonyms: Array<{
    id: string;
    conversationId: string;
    pseudonym: string;
    expiresAt: string;
    rotatedAt: string | null;
    deletedAt: string | null;
  }>;
  deletionRequests: Array<{
    id: string;
    status: string;
    requestedAt: string;
  }>;
  /** Phase 3.11 — owned workspace records only. */
  workspace: {
    claims: Array<{
      id: string;
      topicId: string;
      topicSlug: string;
      topicTitle: string;
      title: string;
      summary: string;
      approachLabel: string;
      workflowState: string;
      moderationVisibility: string;
      updatedAt: string;
    }>;
    evidence: Array<{
      id: string;
      topicId: string;
      topicSlug: string;
      topicTitle: string;
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
      topicId: string;
      claimId: string;
      evidenceSubmissionId: string;
      relationship: string;
    }>;
    conflictDisclosures: Array<{
      id: string;
      claimId: string | null;
      evidenceSubmissionId: string | null;
      publicSummary: string;
      privateDetail: string | null;
      updatedAt: string;
    }>;
    revisionHistory: Array<{
      subjectKind: "claim" | "evidence";
      subjectId: string;
      revisionNumber: number;
      changedFields: string[];
      beforeSnapshot: Record<string, unknown>;
      afterSnapshot: Record<string, unknown>;
      createdAt: string;
    }>;
    topics: Array<{
      id: string;
      slug: string;
      title: string;
      workflowState: string;
      publicationStatus: string;
    }>;
  };
  notice: string;
};

const ACCOUNT_ID_PATTERN = /^account-ostt-[a-z0-9-]+$/i;

function collectStructuredForeignAccountIds(
  bundle: AccountExportBundle,
  actorAccountId: string,
): string[] {
  const foreign: string[] = [];
  const pushIfForeign = (value: unknown) => {
    if (typeof value !== "string") return;
    if (!ACCOUNT_ID_PATTERN.test(value)) return;
    if (value !== actorAccountId) foreign.push(value);
  };

  pushIfForeign(bundle.accountId);

  // Walk known ownership fields — Phase 3 section must never carry foreign owners.
  for (const claim of bundle.workspace.claims) {
    pushIfForeign((claim as { authorAccountId?: string }).authorAccountId);
  }
  for (const row of bundle.workspace.evidence) {
    pushIfForeign((row as { submitterAccountId?: string }).submitterAccountId);
  }
  for (const row of bundle.workspace.conflictDisclosures) {
    pushIfForeign(
      (row as { disclosingAccountId?: string }).disclosingAccountId,
    );
  }
  for (const row of bundle.workspace.revisionHistory) {
    pushIfForeign((row as { editorAccountId?: string }).editorAccountId);
  }

  return [...new Set(foreign)];
}

function abortForeign(
  actorAccountId: string,
  foreignId: string,
): AdapterResult<never> {
  securityLog({
    level: "error",
    event: "privacy.export_foreign_account_leak_blocked",
    subjectRef: operationalSubjectRef(actorAccountId),
    details: { foreignSubjectRef: operationalSubjectRef(foreignId) },
  });
  return {
    ok: false,
    error: "Export aborted — potential cross-account data",
    code: "EXPORT_CROSS_ACCOUNT_BLOCKED",
  };
}

/**
 * Generate an account-holder export containing only that account’s records.
 */
export async function exportOwnAccountData(
  db: FoundationDb,
  actorAccountId: string,
): Promise<AdapterResult<AccountExportBundle>> {
  if (assertEnvironmentSafe() !== "gated") {
    return {
      ok: false,
      error: "Account export is unavailable in public-demo mode",
      code: "PUBLIC_DEMO_NO_EXPORT",
    };
  }

  const principal = await loadPrincipal(db, actorAccountId);
  const decision = await authorizeCapability(db, principal, "account.export_own");
  if (!decision.ok) {
    return { ok: false, error: decision.error, code: decision.code };
  }

  const [account] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, actorAccountId))
    .limit(1);
  if (!account) {
    return { ok: false, error: "Account not found", code: "ACCOUNT_NOT_FOUND" };
  }

  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.accountId, actorAccountId))
    .limit(1);

  const assentRows = await db
    .select({
      id: assentRecords.id,
      documentVersionId: assentRecords.documentVersionId,
      method: assentRecords.method,
      createdAt: assentRecords.createdAt,
    })
    .from(assentRecords)
    .where(eq(assentRecords.accountId, actorAccountId));

  const outcomeRows = await db
    .select({
      id: assentOutcomes.id,
      outcome: assentOutcomes.outcome,
      createdAt: assentOutcomes.createdAt,
    })
    .from(assentOutcomes)
    .where(eq(assentOutcomes.accountId, actorAccountId));

  const verificationRows = await db
    .select({
      id: verificationCases.id,
      kind: verificationCases.kind,
      status: verificationCases.status,
      decidedAt: verificationCases.decidedAt,
    })
    .from(verificationCases)
    .where(eq(verificationCases.accountId, actorAccountId));

  const pseudonymRows = await db
    .select({
      id: conversationPseudonyms.id,
      conversationId: conversationPseudonyms.conversationId,
      pseudonym: conversationPseudonyms.pseudonym,
      expiresAt: conversationPseudonyms.expiresAt,
      rotatedAt: conversationPseudonyms.rotatedAt,
      deletedAt: conversationPseudonyms.deletedAt,
    })
    .from(conversationPseudonyms)
    .where(eq(conversationPseudonyms.accountId, actorAccountId));

  const deletionRows = await db
    .select({
      id: accountDeletionRequests.id,
      status: accountDeletionRequests.status,
      requestedAt: accountDeletionRequests.requestedAt,
    })
    .from(accountDeletionRequests)
    .where(eq(accountDeletionRequests.accountId, actorAccountId));

  // --- Phase 3 owned workspace section ---
  const ownedClaims = await db
    .select({
      id: claims.id,
      topicId: claims.topicId,
      title: claims.title,
      summary: claims.summary,
      approachLabel: claims.approachLabel,
      workflowState: claims.workflowState,
      moderationVisibility: claims.moderationVisibility,
      updatedAt: claims.updatedAt,
      authorAccountId: claims.authorAccountId,
      topicSlug: topics.slug,
      topicTitle: topics.title,
      topicWorkflowState: topics.workflowState,
      topicPublicationStatus: topics.publicationStatus,
    })
    .from(claims)
    .innerJoin(topics, eq(claims.topicId, topics.id))
    .where(eq(claims.authorAccountId, actorAccountId))
    .orderBy(asc(claims.id));

  for (const row of ownedClaims) {
    if (row.authorAccountId !== actorAccountId) {
      return abortForeign(actorAccountId, row.authorAccountId);
    }
  }

  const ownedEvidence = await db
    .select({
      id: evidenceSubmissions.id,
      topicId: evidenceSubmissions.topicId,
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
      submitterAccountId: evidenceSubmissions.submitterAccountId,
      topicSlug: topics.slug,
      topicTitle: topics.title,
      topicWorkflowState: topics.workflowState,
      topicPublicationStatus: topics.publicationStatus,
    })
    .from(evidenceSubmissions)
    .innerJoin(topics, eq(evidenceSubmissions.topicId, topics.id))
    .where(eq(evidenceSubmissions.submitterAccountId, actorAccountId))
    .orderBy(asc(evidenceSubmissions.id));

  for (const row of ownedEvidence) {
    if (row.submitterAccountId !== actorAccountId) {
      return abortForeign(actorAccountId, row.submitterAccountId);
    }
  }

  const ownedClaimIds = ownedClaims.map((row) => row.id);
  const ownedEvidenceIds = ownedEvidence.map((row) => row.id);

  let linkRows: Array<{
    id: string;
    topicId: string;
    claimId: string;
    evidenceSubmissionId: string;
    relationship: string;
  }> = [];
  if (ownedClaimIds.length > 0 || ownedEvidenceIds.length > 0) {
    const linkFilter =
      ownedClaimIds.length > 0 && ownedEvidenceIds.length > 0
        ? or(
            inArray(claimEvidenceLinks.claimId, ownedClaimIds),
            inArray(claimEvidenceLinks.evidenceSubmissionId, ownedEvidenceIds),
          )
        : ownedClaimIds.length > 0
          ? inArray(claimEvidenceLinks.claimId, ownedClaimIds)
          : inArray(claimEvidenceLinks.evidenceSubmissionId, ownedEvidenceIds);
    linkRows = await db
      .select({
        id: claimEvidenceLinks.id,
        topicId: claimEvidenceLinks.topicId,
        claimId: claimEvidenceLinks.claimId,
        evidenceSubmissionId: claimEvidenceLinks.evidenceSubmissionId,
        relationship: claimEvidenceLinks.relationship,
      })
      .from(claimEvidenceLinks)
      .where(linkFilter!)
      .orderBy(asc(claimEvidenceLinks.id));
  }

  // Links must involve only owned submissions on at least one side; drop foreign
  // claim↔evidence pairs that merely share a topic.
  const ownedClaimSet = new Set(ownedClaimIds);
  const ownedEvidenceSet = new Set(ownedEvidenceIds);
  const safeLinks = linkRows.filter(
    (link) =>
      ownedClaimSet.has(link.claimId) ||
      ownedEvidenceSet.has(link.evidenceSubmissionId),
  );

  const disclosureRows = await db
    .select({
      id: conflictDisclosures.id,
      claimId: conflictDisclosures.claimId,
      evidenceSubmissionId: conflictDisclosures.evidenceSubmissionId,
      publicSummary: conflictDisclosures.publicSummary,
      privateDetail: conflictDisclosures.privateDetail,
      updatedAt: conflictDisclosures.updatedAt,
      disclosingAccountId: conflictDisclosures.disclosingAccountId,
    })
    .from(conflictDisclosures)
    .where(eq(conflictDisclosures.disclosingAccountId, actorAccountId))
    .orderBy(asc(conflictDisclosures.id));

  for (const row of disclosureRows) {
    if (row.disclosingAccountId !== actorAccountId) {
      return abortForeign(actorAccountId, row.disclosingAccountId);
    }
  }

  let revisionRows: Array<{
    claimId: string | null;
    evidenceSubmissionId: string | null;
    revisionNumber: number;
    changedFields: string[];
    beforeSnapshot: Record<string, unknown>;
    afterSnapshot: Record<string, unknown>;
    createdAt: Date;
    editorAccountId: string;
  }> = [];
  if (ownedClaimIds.length > 0 || ownedEvidenceIds.length > 0) {
    const revisionFilter =
      ownedClaimIds.length > 0 && ownedEvidenceIds.length > 0
        ? or(
            inArray(contentRevisions.claimId, ownedClaimIds),
            inArray(contentRevisions.evidenceSubmissionId, ownedEvidenceIds),
          )
        : ownedClaimIds.length > 0
          ? inArray(contentRevisions.claimId, ownedClaimIds)
          : inArray(contentRevisions.evidenceSubmissionId, ownedEvidenceIds);
    revisionRows = await db
      .select({
        claimId: contentRevisions.claimId,
        evidenceSubmissionId: contentRevisions.evidenceSubmissionId,
        revisionNumber: contentRevisions.revisionNumber,
        changedFields: contentRevisions.changedFields,
        beforeSnapshot: contentRevisions.beforeSnapshot,
        afterSnapshot: contentRevisions.afterSnapshot,
        createdAt: contentRevisions.createdAt,
        editorAccountId: contentRevisions.editorAccountId,
      })
      .from(contentRevisions)
      .where(revisionFilter!)
      .orderBy(asc(contentRevisions.createdAt));
  }

  // Owner-history authorization already permits owner subject history; include
  // revisions for owned subjects only. Editor may be the owner (edits).
  const safeRevisions = revisionRows.filter((row) => {
    if (row.claimId && ownedClaimSet.has(row.claimId)) return true;
    if (
      row.evidenceSubmissionId &&
      ownedEvidenceSet.has(row.evidenceSubmissionId)
    ) {
      return true;
    }
    return false;
  });

  const topicMap = new Map<
    string,
    {
      id: string;
      slug: string;
      title: string;
      workflowState: string;
      publicationStatus: string;
    }
  >();
  for (const row of ownedClaims) {
    topicMap.set(row.topicId, {
      id: row.topicId,
      slug: row.topicSlug,
      title: row.topicTitle,
      workflowState: row.topicWorkflowState,
      publicationStatus: row.topicPublicationStatus,
    });
  }
  for (const row of ownedEvidence) {
    topicMap.set(row.topicId, {
      id: row.topicId,
      slug: row.topicSlug,
      title: row.topicTitle,
      workflowState: row.topicWorkflowState,
      publicationStatus: row.topicPublicationStatus,
    });
  }

  const bundle: AccountExportBundle = {
    exportedAt: new Date().toISOString(),
    accountId: actorAccountId,
    account: {
      lifecycleState: account.lifecycleState,
      synthetic: account.synthetic,
      contactChannel: account.contactChannel,
      activatedAt: account.activatedAt?.toISOString() ?? null,
      closedAt: account.closedAt?.toISOString() ?? null,
    },
    profile: profile
      ? { preferredDisplayName: profile.preferredDisplayName }
      : null,
    assentRecords: assentRows.map((row) => ({
      id: row.id,
      documentVersionId: row.documentVersionId,
      method: row.method,
      createdAt: row.createdAt.toISOString(),
    })),
    assentOutcomes: outcomeRows.map((row) => ({
      id: row.id,
      outcome: row.outcome,
      createdAt: row.createdAt.toISOString(),
    })),
    verificationCases: verificationRows.map((row) => ({
      id: row.id,
      kind: row.kind,
      status: row.status,
      decidedAt: row.decidedAt?.toISOString() ?? null,
    })),
    conversationPseudonyms: pseudonymRows.map((row) => ({
      id: row.id,
      conversationId: row.conversationId,
      pseudonym: row.pseudonym,
      expiresAt: row.expiresAt.toISOString(),
      rotatedAt: row.rotatedAt?.toISOString() ?? null,
      deletedAt: row.deletedAt?.toISOString() ?? null,
    })),
    deletionRequests: deletionRows.map((row) => ({
      id: row.id,
      status: row.status,
      requestedAt: row.requestedAt.toISOString(),
    })),
    workspace: {
      claims: ownedClaims.map((row) => ({
        id: row.id,
        topicId: row.topicId,
        topicSlug: row.topicSlug,
        topicTitle: row.topicTitle,
        title: row.title,
        summary: row.summary,
        approachLabel: row.approachLabel,
        workflowState: row.workflowState,
        moderationVisibility: row.moderationVisibility,
        updatedAt: row.updatedAt.toISOString(),
      })),
      evidence: ownedEvidence.map((row) => ({
        id: row.id,
        topicId: row.topicId,
        topicSlug: row.topicSlug,
        topicTitle: row.topicTitle,
        title: row.title,
        organization: row.organization,
        authorType: row.authorType,
        sourceType: row.sourceType,
        limitations: row.limitations,
        sourceUrl: row.sourceUrl,
        workflowState: row.workflowState,
        qualityStatus: row.qualityStatus,
        moderationVisibility: row.moderationVisibility,
        updatedAt: row.updatedAt.toISOString(),
      })),
      links: safeLinks.map((row) => ({
        id: row.id,
        topicId: row.topicId,
        claimId: row.claimId,
        evidenceSubmissionId: row.evidenceSubmissionId,
        relationship: row.relationship,
      })),
      conflictDisclosures: disclosureRows.map((row) => ({
        id: row.id,
        claimId: row.claimId,
        evidenceSubmissionId: row.evidenceSubmissionId,
        publicSummary: row.publicSummary,
        privateDetail: row.privateDetail,
        updatedAt: row.updatedAt.toISOString(),
      })),
      revisionHistory: safeRevisions.map((row) => ({
        subjectKind: row.claimId ? ("claim" as const) : ("evidence" as const),
        subjectId: (row.claimId ?? row.evidenceSubmissionId)!,
        revisionNumber: row.revisionNumber,
        changedFields: row.changedFields,
        beforeSnapshot: row.beforeSnapshot,
        afterSnapshot: row.afterSnapshot,
        createdAt: row.createdAt.toISOString(),
      })),
      topics: [...topicMap.values()].sort((a, b) => a.id.localeCompare(b.id)),
    },
    notice:
      "Provisional account-holder export. Includes owned Phase 3 workspace records only. Does not include other accounts, staff-restricted audit private payloads, staff private notes, or legal-hold dockets.",
  };

  // Structured ownership invariant before serialization-based checks.
  const structuredForeign = collectStructuredForeignAccountIds(
    bundle,
    actorAccountId,
  );
  if (structuredForeign.length > 0) {
    return abortForeign(actorAccountId, structuredForeign[0]!);
  }

  // Hard invariant: serialized export must not contain another account id.
  const blob = JSON.stringify(bundle);
  const accountIds = blob.match(/account-ostt-[a-z0-9-]+/gi) ?? [];
  for (const id of accountIds) {
    if (id !== actorAccountId) {
      return abortForeign(actorAccountId, id);
    }
  }

  await appendAuthAudit(db, {
    actorRole: "account_holder",
    actorAccountId,
    action: "privacy.export_generated",
    subjectType: "account",
    subjectId: actorAccountId,
    summary: "Account holder data export generated.",
    synthetic: account.synthetic,
  });

  securityLog({
    level: "info",
    event: "privacy.export_generated",
    subjectRef: operationalSubjectRef(actorAccountId),
  });

  return { ok: true, value: bundle };
}
