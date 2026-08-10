import { and, eq, isNull } from "drizzle-orm";

import { invitations } from "@/db/schema";
import type { FoundationDb } from "@/db/types";
import { evaluateActivationGates } from "@/lib/onboarding/gates";

export type OnboardingStepId =
  | "invite"
  | "contact"
  | "eligibility"
  | "documents"
  | "verification"
  | "activate";

export type OnboardingStepStatus =
  | "complete"
  | "current"
  | "blocked"
  | "available"
  | "declined";

export type OnboardingStep = {
  id: OnboardingStepId;
  title: string;
  why: string;
  status: OnboardingStepStatus;
  detail?: string;
  href?: string;
};

export type OnboardingProgress = {
  accountId: string;
  lifecycleState: string;
  synthetic: boolean;
  canActivate: boolean;
  engineeringReady: boolean;
  counselBlocksReal: boolean;
  blockingReasons: string[];
  steps: OnboardingStep[];
};

/**
 * Activation floor: current assent to every published document + L3 uniqueness
 * + eligibility. Real (non-synthetic) accounts additionally require cleared
 * counsel dispositions (see `src/lib/counsel/dispositions.ts`).
 */
export async function getOnboardingProgress(
  db: FoundationDb,
  accountId: string,
  now = new Date(),
): Promise<OnboardingProgress | null> {
  const gates = await evaluateActivationGates(db, accountId, now);
  if (!gates) {
    return null;
  }

  const steps: OnboardingStep[] = [
    {
      id: "invite",
      title: "Invitation",
      why: "Enrollment is invite-only; uninvited visitors cannot begin.",
      status: gates.inviteAccepted ? "complete" : "blocked",
      detail: gates.inviteAccepted
        ? "Invitation accepted."
        : "A valid invitation is required.",
      href: "/auth/accept",
    },
    {
      id: "contact",
      title: "Contact continuity",
      why: "Prove control of the invite contact channel before onboarding continues.",
      status: gates.contactVerified
        ? "complete"
        : gates.inviteAccepted
          ? "current"
          : "blocked",
      detail: gates.contactVerified
        ? "Contact channel verified."
        : "Complete the email challenge from your invitation.",
      href: "/auth/complete",
    },
    {
      id: "eligibility",
      title: "Eligibility assertion",
      why: "Record a distinct eligibility assertion (not a national-mandate claim; counsel gates remain open).",
      status: !gates.contactVerified
        ? "blocked"
        : gates.hasEligibility
          ? "complete"
          : "current",
      detail: gates.hasEligibility
        ? "Eligibility assertion approved."
        : "Open an eligibility case below, then wait for reviewer approval.",
      href: "/account/verification",
    },
    {
      id: "documents",
      title: "Document review and assent",
      why: "Present complete published documents, acknowledge required notices, then assent (or decline).",
      status: !gates.contactVerified
        ? "blocked"
        : gates.documentsComplete
          ? "complete"
          : "current",
      detail: gates.documentsComplete
        ? "Current assent on file for all published documents."
        : gates.missingDocumentTitles.length === 0
          ? "Waiting for published documents."
          : `${gates.missingDocumentTitles.length} document(s) still require assent.`,
      href: "/account/assent",
    },
    {
      id: "verification",
      title: "Assurance ladder (L3)",
      why: "Bot resistance, contact continuity, and uniqueness assertions are required before activation.",
      status: !gates.contactVerified
        ? "blocked"
        : gates.hasL3
          ? "complete"
          : gates.hasL2
            ? "current"
            : "available",
      detail: gates.hasL3
        ? "Required L3 assertions approved."
        : "Open the missing L3 cases on the verification page (session-scoped).",
      href: "/account/verification",
    },
    {
      id: "activate",
      title: "Activate account",
      why: "The only production transition from pending_onboarding to active runs after assent, verification, and counsel constraints pass.",
      status:
        gates.lifecycleState === "active"
          ? "complete"
          : gates.canActivate
            ? "available"
            : "blocked",
      detail:
        gates.lifecycleState === "active"
          ? "Account is active (account holder / community participant — not a statutory membership claim)."
          : gates.canActivate
            ? "All engineering and counsel constraints passed for this account."
            : gates.blockingReasons[0] ?? "Complete prior steps.",
      href: "/account/onboarding",
    },
  ];

  return {
    accountId: gates.accountId,
    lifecycleState: gates.lifecycleState,
    synthetic: gates.synthetic,
    canActivate: gates.canActivate,
    engineeringReady: gates.engineeringReady,
    counselBlocksReal: gates.counselBlocksReal,
    blockingReasons: gates.blockingReasons,
    steps,
  };
}

export async function findPendingInvitationByTokenHash(
  db: FoundationDb,
  tokenHash: string,
) {
  const [row] = await db
    .select({
      id: invitations.id,
      status: invitations.status,
      expiresAt: invitations.expiresAt,
    })
    .from(invitations)
    .where(
      and(
        eq(invitations.tokenHash, tokenHash),
        eq(invitations.status, "pending"),
        isNull(invitations.acceptedAccountId),
      ),
    )
    .limit(1);
  return row ?? null;
}
