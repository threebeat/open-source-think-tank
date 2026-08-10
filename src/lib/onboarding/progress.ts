import { and, eq, isNull } from "drizzle-orm";

import { accounts, invitations } from "@/db/schema";
import type { FoundationDb } from "@/db/types";
import { mapActiveAccountToApplicableDocuments } from "@/lib/assent/status";
import { L2_KINDS, L3_KINDS } from "@/lib/verification/seed-assurance";
import { approvedKindsForAccount } from "@/lib/verification/status";

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
  blockingReasons: string[];
  steps: OnboardingStep[];
};

/**
 * Activation floor: current assent to every published document + L3 uniqueness
 * ladder (bot, contact, uniqueness). Eligibility is a distinct step (counsel-gated
 * geography claims remain unresolved).
 */
export async function getOnboardingProgress(
  db: FoundationDb,
  accountId: string,
): Promise<OnboardingProgress | null> {
  const [account] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .limit(1);
  if (!account) {
    return null;
  }

  const [invite] = await db
    .select()
    .from(invitations)
    .where(
      and(
        eq(invitations.acceptedAccountId, accountId),
        eq(invitations.status, "accepted"),
      ),
    )
    .limit(1);

  const documents = await mapActiveAccountToApplicableDocuments(db, accountId);
  const missingAssent = documents.filter((doc) => doc.requiresAssent);
  const approved = await approvedKindsForAccount(db, accountId);
  const hasL2 = L2_KINDS.every((kind) => approved.has(kind));
  const hasL3 = L3_KINDS.every((kind) => approved.has(kind));
  const hasEligibility = approved.has("eligibility");

  const inviteComplete = Boolean(invite) || account.lifecycleState !== "invited";
  const contactComplete = Boolean(account.contactVerifiedAt);
  const documentsComplete =
    documents.length > 0 && missingAssent.length === 0;

  const blockingReasons: string[] = [];
  if (account.lifecycleState === "active") {
    // already active
  } else if (account.lifecycleState !== "pending_onboarding") {
    blockingReasons.push("Account must complete contact verification first.");
  } else {
    if (!documentsComplete) {
      if (documents.length === 0) {
        blockingReasons.push("No published assent documents are available yet.");
      } else {
        blockingReasons.push(
          `Assent required for: ${missingAssent.map((d) => d.title).join(", ")}.`,
        );
      }
    }
    if (!hasL3) {
      const missing = L3_KINDS.filter((k) => !approved.has(k));
      blockingReasons.push(
        `Verification required (approved): ${missing.join(", ")}.`,
      );
    }
    if (!hasEligibility) {
      blockingReasons.push(
        "Eligibility assertion must be approved before activation (engineering gate; counsel geography rules remain open).",
      );
    }
  }

  const canActivate =
    account.lifecycleState === "pending_onboarding" &&
    documentsComplete &&
    hasL3 &&
    hasEligibility &&
    blockingReasons.length === 0;

  const steps: OnboardingStep[] = [
    {
      id: "invite",
      title: "Invitation",
      why: "Enrollment is invite-only; uninvited visitors cannot begin.",
      status: inviteComplete ? "complete" : "blocked",
      detail: invite
        ? "Invitation accepted."
        : "A valid invitation is required.",
      href: "/auth/accept",
    },
    {
      id: "contact",
      title: "Contact continuity",
      why: "Prove control of the invite contact channel before onboarding continues.",
      status: contactComplete
        ? "complete"
        : inviteComplete
          ? "current"
          : "blocked",
      detail: contactComplete
        ? "Contact channel verified."
        : "Complete the email challenge from your invitation.",
      href: "/auth/complete",
    },
    {
      id: "eligibility",
      title: "Eligibility assertion",
      why: "Record a distinct eligibility assertion (not a national-mandate claim; counsel gates remain open).",
      status: !contactComplete
        ? "blocked"
        : hasEligibility
          ? "complete"
          : "current",
      detail: hasEligibility
        ? "Eligibility assertion approved."
        : "Open and complete an eligibility verification case.",
      href: "/account/verification",
    },
    {
      id: "documents",
      title: "Document review and assent",
      why: "Present complete published documents, acknowledge required notices, then assent (or decline).",
      status: !contactComplete
        ? "blocked"
        : documentsComplete
          ? "complete"
          : "current",
      detail:
        documents.length === 0
          ? "Waiting for published documents."
          : documentsComplete
            ? "Current assent on file for all published documents."
            : `${missingAssent.length} document(s) still require assent.`,
      href: "/account/assent",
    },
    {
      id: "verification",
      title: "Assurance ladder (L3)",
      why: "Bot resistance, contact continuity, and uniqueness assertions are required before activation.",
      status: !contactComplete
        ? "blocked"
        : hasL3
          ? "complete"
          : hasL2
            ? "current"
            : "available",
      detail: hasL3
        ? "Required L3 assertions approved."
        : `Missing: ${L3_KINDS.filter((k) => !approved.has(k)).join(", ") || "none"}.`,
      href: "/account/verification",
    },
    {
      id: "activate",
      title: "Activate account",
      why: "The only production transition from pending_onboarding to active runs after assent and verification gates pass.",
      status:
        account.lifecycleState === "active"
          ? "complete"
          : canActivate
            ? "available"
            : "blocked",
      detail:
        account.lifecycleState === "active"
          ? "Account is active (account holder / community participant — not a statutory membership claim)."
          : canActivate
            ? "All gates passed. You may activate."
            : blockingReasons[0] ?? "Complete prior steps.",
      href: "/account/onboarding",
    },
  ];

  return {
    accountId,
    lifecycleState: account.lifecycleState,
    synthetic: account.synthetic,
    canActivate,
    blockingReasons,
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
