import { and, desc, eq, gt, isNull, or } from "drizzle-orm";

import { verificationCases } from "@/db/schema";
import type { VerificationAssertionKind } from "@/lib/adapters/verification";
import type { Capability } from "@/lib/authz/types";
import type { GatedDb } from "@/lib/persistence/gated";
import {
  ASSURANCE_LEVELS,
  assuranceForCapability,
  type AssuranceLevelId,
} from "@/lib/verification/ladder";

export type VerificationStatusView = {
  kind: VerificationAssertionKind;
  status:
    | "none"
    | "pending"
    | "approved"
    | "denied"
    | "expired"
    | "appealed"
    | "revoked";
  caseId: string | null;
  expiresAt: string | null;
  /** Never includes evidence pointers or raw artifacts. */
};

function effectiveStatus(
  status: VerificationStatusView["status"] | "approved",
  expiresAt: Date | null,
  now: Date,
): VerificationStatusView["status"] {
  if (
    status === "approved" &&
    expiresAt &&
    expiresAt.getTime() <= now.getTime()
  ) {
    return "expired";
  }
  return status;
}

/** Status-only view for an account — safe for account-private surfaces. */
export async function listAccountVerificationStatus(
  db: GatedDb,
  accountId: string,
): Promise<VerificationStatusView[]> {
  const now = new Date();
  const rows = await db
    .select({
      id: verificationCases.id,
      kind: verificationCases.kind,
      status: verificationCases.status,
      expiresAt: verificationCases.expiresAt,
      updatedAt: verificationCases.updatedAt,
    })
    .from(verificationCases)
    .where(eq(verificationCases.accountId, accountId))
    .orderBy(desc(verificationCases.updatedAt));

  const byKind = new Map<VerificationAssertionKind, VerificationStatusView>();
  for (const row of rows) {
    if (byKind.has(row.kind)) {
      continue;
    }
    byKind.set(row.kind, {
      kind: row.kind,
      status: effectiveStatus(row.status, row.expiresAt, now),
      caseId: row.id,
      expiresAt: row.expiresAt?.toISOString() ?? null,
    });
  }
  return [...byKind.values()];
}

export async function getKindStatus(
  db: GatedDb,
  accountId: string,
  kind: VerificationAssertionKind,
): Promise<VerificationStatusView["status"]> {
  const now = new Date();
  const [open] = await db
    .select()
    .from(verificationCases)
    .where(
      and(
        eq(verificationCases.accountId, accountId),
        eq(verificationCases.kind, kind),
        or(
          eq(verificationCases.status, "pending"),
          eq(verificationCases.status, "appealed"),
          and(
            eq(verificationCases.status, "approved"),
            or(
              isNull(verificationCases.expiresAt),
              gt(verificationCases.expiresAt, now),
            ),
          ),
        ),
      ),
    )
    .limit(1);
  if (open) {
    return open.status;
  }

  const [latest] = await db
    .select()
    .from(verificationCases)
    .where(
      and(
        eq(verificationCases.accountId, accountId),
        eq(verificationCases.kind, kind),
      ),
    )
    .orderBy(desc(verificationCases.updatedAt))
    .limit(1);

  if (!latest) {
    return "none";
  }
  return effectiveStatus(latest.status, latest.expiresAt, now);
}

export async function approvedKindsForAccount(
  db: GatedDb,
  accountId: string,
): Promise<Set<VerificationAssertionKind>> {
  const now = new Date();
  const rows = await db
    .select()
    .from(verificationCases)
    .where(
      and(
        eq(verificationCases.accountId, accountId),
        eq(verificationCases.status, "approved"),
        or(
          isNull(verificationCases.expiresAt),
          gt(verificationCases.expiresAt, now),
        ),
      ),
    );

  return new Set(rows.map((row) => row.kind));
}

export async function evaluateAssurance(
  db: GatedDb,
  accountId: string,
  capability: Capability,
): Promise<{
  ok: boolean;
  requiredLevel: AssuranceLevelId;
  missingKinds: VerificationAssertionKind[];
}> {
  const level = assuranceForCapability(capability);
  const approved = await approvedKindsForAccount(db, accountId);
  const missing = level.requiredKinds.filter((kind) => !approved.has(kind));
  return {
    ok: missing.length === 0,
    requiredLevel: level.id as AssuranceLevelId,
    missingKinds: missing,
  };
}

export function describeAssuranceLadder() {
  return Object.values(ASSURANCE_LEVELS).map((level) => ({
    id: level.id,
    rank: level.rank,
    label: level.label,
    requiredKinds: level.requiredKinds,
    disclaimer:
      "Not proof of ideology, credibility, or policy expertise. Government ID is not assumed.",
  }));
}
