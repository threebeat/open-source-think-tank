import { verificationAssertions, verificationCases } from "@/db/schema";
import type { FoundationDb } from "@/db/types";
import type { VerificationAssertionKind } from "@/lib/adapters/verification";
import { newEntityId } from "@/lib/auth/tokens";

/** Re-export production-neutral kind sets for test convenience only. */
export {
  L2_KINDS,
  L3_KINDS,
  L4_KINDS,
} from "@/lib/verification/assertion-kinds";

/**
 * Test/seed helper: insert approved assertion rows without reviewer workflow.
 * Used to bootstrap assurance for synthetic fixtures (chicken-and-egg).
 * Operational code must not import this module for kind constants alone —
 * use `@/lib/verification/assertion-kinds` instead.
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
