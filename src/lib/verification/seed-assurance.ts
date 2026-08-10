import { verificationAssertions, verificationCases } from "@/db/schema";
import type { FoundationDb } from "@/db/types";
import type { VerificationAssertionKind } from "@/lib/adapters/verification";
import { newEntityId } from "@/lib/auth/tokens";

/**
 * Test/seed helper: insert approved assertion rows without reviewer workflow.
 * Used to bootstrap assurance for synthetic fixtures (chicken-and-egg).
 */
export async function seedApprovedAssertions(
  db: FoundationDb,
  accountId: string,
  kinds: VerificationAssertionKind[],
  options?: { expiresAt?: Date | null; status?: "approved" | "revoked" | "expired" },
) {
  const status = options?.status ?? "approved";
  const now = new Date();
  for (const kind of kinds) {
    const caseId = newEntityId("vcase");
    await db.insert(verificationCases).values({
      id: caseId,
      accountId,
      kind,
      status,
      decisionReason:
        status === "approved"
          ? "Synthetic seed approval for assurance bootstrap."
          : `Synthetic seed ${status} for assurance tests.`,
      decidedAt: now,
      expiresAt: options?.expiresAt ?? null,
      synthetic: true,
    });
    await db.insert(verificationAssertions).values({
      id: newEntityId("vassert"),
      caseId,
      kind,
      assertionSummary: `Synthetic ${kind} assertion (seed).`,
    });
  }
}

/** Kinds required for L2 (reviewer / auditor floor). */
export const L2_KINDS: VerificationAssertionKind[] = [
  "bot_resistance",
  "contact_continuity",
];

/** Kinds required for L3 (vote / publish / role changes). */
export const L3_KINDS: VerificationAssertionKind[] = [
  ...L2_KINDS,
  "uniqueness",
];

/** Kinds required for L4 (council). */
export const L4_KINDS: VerificationAssertionKind[] = [
  ...L3_KINDS,
  "eligibility",
];
