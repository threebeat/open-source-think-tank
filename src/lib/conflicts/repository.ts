import { and, eq, isNotNull } from "drizzle-orm";

import { conflictDisclosures } from "@/db/schema";
import type { AdapterResult } from "@/lib/adapters/types";
import { newEntityId } from "@/lib/auth/tokens";
import {
  type GatedDb,
  requireGatedPersistence,
} from "@/lib/persistence/gated";

/**
 * Full gated disclosure record. Private detail must never be required by
 * future public projections — use {@link toPublicConflictDisclosure}.
 */
export type ConflictDisclosureRecord = {
  id: string;
  disclosingAccountId: string;
  claimId: string | null;
  evidenceSubmissionId: string | null;
  publicSummary: string;
  privateDetail: string | null;
  synthetic: boolean;
  createdAt: Date;
  updatedAt: Date;
};

/** Safe projection fields for future public surfaces. */
export type PublicConflictDisclosure = {
  id: string;
  claimId: string | null;
  evidenceSubmissionId: string | null;
  publicSummary: string;
  synthetic: boolean;
  createdAt: Date;
};

export function toPublicConflictDisclosure(
  row: ConflictDisclosureRecord,
): PublicConflictDisclosure {
  return {
    id: row.id,
    claimId: row.claimId,
    evidenceSubmissionId: row.evidenceSubmissionId,
    publicSummary: row.publicSummary,
    synthetic: row.synthetic,
    createdAt: row.createdAt,
  };
}

function mapDisclosure(
  row: typeof conflictDisclosures.$inferSelect,
): ConflictDisclosureRecord {
  return {
    id: row.id,
    disclosingAccountId: row.disclosingAccountId,
    claimId: row.claimId,
    evidenceSubmissionId: row.evidenceSubmissionId,
    publicSummary: row.publicSummary,
    privateDetail: row.privateDetail,
    synthetic: row.synthetic,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function insertConflictDisclosure(
  db: GatedDb,
  input: {
    disclosingAccountId: string;
    claimId?: string | null;
    evidenceSubmissionId?: string | null;
    publicSummary: string;
    privateDetail?: string | null;
    synthetic: boolean;
  },
): Promise<AdapterResult<ConflictDisclosureRecord>> {
  const denied = requireGatedPersistence();
  if (denied) {
    return denied;
  }

  const claimId = input.claimId ?? null;
  const evidenceSubmissionId = input.evidenceSubmissionId ?? null;
  if (
    (claimId === null && evidenceSubmissionId === null) ||
    (claimId !== null && evidenceSubmissionId !== null)
  ) {
    return {
      ok: false,
      error: "Disclosure must attach to exactly one subject",
      code: "CONFLICT_DISCLOSURE_SUBJECT_INVALID",
    };
  }

  const id = newEntityId("cdisc");
  const [row] = await db
    .insert(conflictDisclosures)
    .values({
      id,
      disclosingAccountId: input.disclosingAccountId,
      claimId,
      evidenceSubmissionId,
      publicSummary: input.publicSummary,
      privateDetail: input.privateDetail ?? null,
      synthetic: input.synthetic,
    })
    .returning();

  if (!row) {
    return {
      ok: false,
      error: "Failed to insert conflict disclosure",
      code: "CONFLICT_DISCLOSURE_INSERT_FAILED",
    };
  }
  return { ok: true, value: mapDisclosure(row) };
}

export async function listConflictDisclosuresForClaim(
  db: GatedDb,
  claimId: string,
): Promise<AdapterResult<ConflictDisclosureRecord[]>> {
  const denied = requireGatedPersistence();
  if (denied) {
    return denied;
  }
  const rows = await db
    .select()
    .from(conflictDisclosures)
    .where(
      and(
        eq(conflictDisclosures.claimId, claimId),
        isNotNull(conflictDisclosures.claimId),
      ),
    );
  return { ok: true, value: rows.map(mapDisclosure) };
}

export async function listConflictDisclosuresForEvidence(
  db: GatedDb,
  evidenceSubmissionId: string,
): Promise<AdapterResult<ConflictDisclosureRecord[]>> {
  const denied = requireGatedPersistence();
  if (denied) {
    return denied;
  }
  const rows = await db
    .select()
    .from(conflictDisclosures)
    .where(
      and(
        eq(conflictDisclosures.evidenceSubmissionId, evidenceSubmissionId),
        isNotNull(conflictDisclosures.evidenceSubmissionId),
      ),
    );
  return { ok: true, value: rows.map(mapDisclosure) };
}
