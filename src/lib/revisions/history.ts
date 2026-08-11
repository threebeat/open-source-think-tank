import type { AdapterResult } from "@/lib/adapters/types";
import { authorizeCapability } from "@/lib/authz/authorize-capability";
import { loadPrincipal } from "@/lib/authz/load-principal";
import { getClaimById } from "@/lib/claims/repository";
import { assertEnvironmentSafe } from "@/lib/env/app-mode";
import { getEvidenceSubmissionById } from "@/lib/evidence/repository";
import type { GatedDb } from "@/lib/persistence/gated";
import {
  listClaimContentRevisions,
  listEvidenceContentRevisions,
  type ContentRevisionRecord,
} from "@/lib/revisions/repository";
import {
  CONTENT_FIELD_LABELS,
  PUBLIC_FIELD_UPDATE_LABELS,
  type ClaimContentSnapshot,
  type EvidenceContentSnapshot,
} from "@/lib/revisions/schemas";

/** Owner/staff full history entry — never includes private notes or reviewer IDs. */
export type ContentRevisionHistoryEntry = {
  revisionNumber: number;
  createdAt: string;
  changedFieldLabels: string[];
  before: ClaimContentSnapshot | EvidenceContentSnapshot;
  after: ClaimContentSnapshot | EvidenceContentSnapshot;
};

export type ContentRevisionHistoryDto = {
  subjectKind: "claim" | "evidence";
  subjectId: string;
  entries: ContentRevisionHistoryEntry[];
  latestRevisionAt: string | null;
};

/** Public allowlisted summary — never bodies, URLs, or internal IDs. */
export type PublicRevisionSummary = {
  revisionCount: number;
  latestRevisionAt: string | null;
  changedFieldLabels: string[];
};

function gatedOrDeny<T>(): AdapterResult<T> | null {
  if (assertEnvironmentSafe() !== "gated") {
    return {
      ok: false,
      error: "Revision history unavailable in public-demo mode",
      code: "PUBLIC_DEMO_NO_REVISIONS",
    };
  }
  return null;
}

function toHistoryEntry(row: ContentRevisionRecord): ContentRevisionHistoryEntry {
  return {
    revisionNumber: row.revisionNumber,
    createdAt: row.createdAt.toISOString(),
    changedFieldLabels: row.changedFields.map(
      (field) => CONTENT_FIELD_LABELS[field] ?? field,
    ),
    before: row.beforeSnapshot,
    after: row.afterSnapshot,
  };
}

function mapAuthzError(error: unknown): AdapterResult<never> | null {
  if (
    error &&
    typeof error === "object" &&
    "decision" in error &&
    error.decision &&
    typeof error.decision === "object" &&
    "ok" in error.decision &&
    (error.decision as { ok: boolean }).ok === false
  ) {
    const decision = error.decision as unknown as {
      error: string;
      code: string;
    };
    return { ok: false, error: decision.error, code: decision.code };
  }
  return null;
}

/**
 * Owner-only full claim revision history (no reviewer notes / account IDs in DTO).
 */
export async function getOwnClaimRevisionHistory(
  db: GatedDb,
  input: { actorAccountId: string; claimId: string },
): Promise<AdapterResult<ContentRevisionHistoryDto>> {
  const denied = gatedOrDeny<ContentRevisionHistoryDto>();
  if (denied) return denied;

  try {
    const principal = await loadPrincipal(db, input.actorAccountId);
    if (!principal) {
      return { ok: false, error: "Account not found", code: "AUTH_REQUIRED" };
    }
    const decision = await authorizeCapability(
      db,
      principal,
      "claims.edit_own",
    );
    if (!decision.ok) {
      return { ok: false, error: decision.error, code: decision.code };
    }

    const claim = await getClaimById(db, input.claimId);
    if (!claim.ok || !claim.value) {
      return { ok: false, error: "Not found", code: "CLAIM_NOT_FOUND" };
    }
    if (claim.value.authorAccountId !== principal.accountId) {
      return { ok: false, error: "Not found", code: "CLAIM_NOT_FOUND" };
    }

    const rows = await listClaimContentRevisions(db, claim.value.id);
    if (!rows.ok) return rows;
    const entries = rows.value.map(toHistoryEntry);
    return {
      ok: true,
      value: {
        subjectKind: "claim",
        subjectId: claim.value.id,
        entries,
        latestRevisionAt: entries.at(-1)?.createdAt ?? null,
      },
    };
  } catch (error) {
    return (
      mapAuthzError(error) ?? {
        ok: false,
        error: "History load failed",
        code: "REVISION_HISTORY_FAILED",
      }
    );
  }
}

export async function getOwnEvidenceRevisionHistory(
  db: GatedDb,
  input: { actorAccountId: string; evidenceSubmissionId: string },
): Promise<AdapterResult<ContentRevisionHistoryDto>> {
  const denied = gatedOrDeny<ContentRevisionHistoryDto>();
  if (denied) return denied;

  try {
    const principal = await loadPrincipal(db, input.actorAccountId);
    if (!principal) {
      return { ok: false, error: "Account not found", code: "AUTH_REQUIRED" };
    }
    const decision = await authorizeCapability(
      db,
      principal,
      "evidence.edit_own",
    );
    if (!decision.ok) {
      return { ok: false, error: decision.error, code: decision.code };
    }

    const evidence = await getEvidenceSubmissionById(
      db,
      input.evidenceSubmissionId,
    );
    if (!evidence.ok || !evidence.value) {
      return { ok: false, error: "Not found", code: "EVIDENCE_NOT_FOUND" };
    }
    if (evidence.value.submitterAccountId !== principal.accountId) {
      return { ok: false, error: "Not found", code: "EVIDENCE_NOT_FOUND" };
    }

    const rows = await listEvidenceContentRevisions(db, evidence.value.id);
    if (!rows.ok) return rows;
    const entries = rows.value.map(toHistoryEntry);
    return {
      ok: true,
      value: {
        subjectKind: "evidence",
        subjectId: evidence.value.id,
        entries,
        latestRevisionAt: entries.at(-1)?.createdAt ?? null,
      },
    };
  } catch (error) {
    return (
      mapAuthzError(error) ?? {
        ok: false,
        error: "History load failed",
        code: "REVISION_HISTORY_FAILED",
      }
    );
  }
}

/**
 * Staff claim revision history — requires claims.review.
 * Editor account IDs are omitted from the DTO (chronology + content only).
 */
export async function getStaffClaimRevisionHistory(
  db: GatedDb,
  input: { actorAccountId: string; claimId: string },
): Promise<AdapterResult<ContentRevisionHistoryDto>> {
  const denied = gatedOrDeny<ContentRevisionHistoryDto>();
  if (denied) return denied;

  try {
    const principal = await loadPrincipal(db, input.actorAccountId);
    if (!principal) {
      return { ok: false, error: "Account not found", code: "AUTH_REQUIRED" };
    }
    const decision = await authorizeCapability(db, principal, "claims.review");
    if (!decision.ok) {
      return { ok: false, error: decision.error, code: decision.code };
    }

    const claim = await getClaimById(db, input.claimId);
    if (!claim.ok || !claim.value) {
      return { ok: false, error: "Not found", code: "CLAIM_NOT_FOUND" };
    }

    const rows = await listClaimContentRevisions(db, claim.value.id);
    if (!rows.ok) return rows;
    const entries = rows.value.map(toHistoryEntry);
    return {
      ok: true,
      value: {
        subjectKind: "claim",
        subjectId: claim.value.id,
        entries,
        latestRevisionAt: entries.at(-1)?.createdAt ?? null,
      },
    };
  } catch (error) {
    return (
      mapAuthzError(error) ?? {
        ok: false,
        error: "History load failed",
        code: "REVISION_HISTORY_FAILED",
      }
    );
  }
}

export async function getStaffEvidenceRevisionHistory(
  db: GatedDb,
  input: { actorAccountId: string; evidenceSubmissionId: string },
): Promise<AdapterResult<ContentRevisionHistoryDto>> {
  const denied = gatedOrDeny<ContentRevisionHistoryDto>();
  if (denied) return denied;

  try {
    const principal = await loadPrincipal(db, input.actorAccountId);
    if (!principal) {
      return { ok: false, error: "Account not found", code: "AUTH_REQUIRED" };
    }
    const decision = await authorizeCapability(
      db,
      principal,
      "evidence.review",
    );
    if (!decision.ok) {
      return { ok: false, error: decision.error, code: decision.code };
    }

    const evidence = await getEvidenceSubmissionById(
      db,
      input.evidenceSubmissionId,
    );
    if (!evidence.ok || !evidence.value) {
      return { ok: false, error: "Not found", code: "EVIDENCE_NOT_FOUND" };
    }

    const rows = await listEvidenceContentRevisions(db, evidence.value.id);
    if (!rows.ok) return rows;
    const entries = rows.value.map(toHistoryEntry);
    return {
      ok: true,
      value: {
        subjectKind: "evidence",
        subjectId: evidence.value.id,
        entries,
        latestRevisionAt: entries.at(-1)?.createdAt ?? null,
      },
    };
  } catch (error) {
    return (
      mapAuthzError(error) ?? {
        ok: false,
        error: "History load failed",
        code: "REVISION_HISTORY_FAILED",
      }
    );
  }
}

export function toPublicRevisionSummary(input: {
  count: number;
  latestAt: Date | null;
  changedFields: string[];
}): PublicRevisionSummary | null {
  if (input.count <= 0) return null;
  return {
    revisionCount: input.count,
    latestRevisionAt: input.latestAt ? input.latestAt.toISOString() : null,
    changedFieldLabels: input.changedFields.map(
      (field) => PUBLIC_FIELD_UPDATE_LABELS[field] ?? `${field} updated`,
    ),
  };
}
