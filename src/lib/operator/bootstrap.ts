import { and, eq, isNull, sql } from "drizzle-orm";

import {
  accounts,
  invitations,
  operatorBootstrapState,
  roleAssignments,
  verificationAssertions,
  verificationCases,
} from "@/db/schema";
import type { FoundationDb } from "@/db/types";
import type { AdapterResult } from "@/lib/adapters/types";
import type { VerificationAssertionKind } from "@/lib/adapters/verification";
import { appendAuthAudit, type AuthAuditDb } from "@/lib/auth/audit-log";
import { generateOpaqueToken, hashToken, newEntityId } from "@/lib/auth/tokens";
import { activateAccount } from "@/lib/onboarding/activate";
import { requireOperatorBootstrapEnv } from "@/lib/operator/secrets";
import { L3_KINDS } from "@/lib/verification/seed-assurance";

const BOOTSTRAP_STATE_ID = "default";
const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const BOOTSTRAP_KINDS: VerificationAssertionKind[] = [
  ...L3_KINDS,
  "eligibility",
];

function resolveAppBaseUrl(): string {
  return (
    process.env.AUTH_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    "http://127.0.0.1:3000"
  ).replace(/\/$/, "");
}

async function countActiveAdministrators(db: AuthAuditDb): Promise<number> {
  const rows = await db
    .select({ id: roleAssignments.id })
    .from(roleAssignments)
    .where(
      and(
        eq(roleAssignments.role, "administrator"),
        isNull(roleAssignments.revokedAt),
      ),
    );
  return rows.length;
}

export type BootstrapIssueResult = {
  invitationId: string;
  expiresAt: string;
  rawToken: string;
  acceptanceLink: string;
  operatorLabel: string;
};

/**
 * Issue the single live administrator-bootstrap invitation (hash only).
 */
export async function issueAdministratorBootstrapInvitation(
  db: FoundationDb,
  input: {
    intendedContactChannel: string;
    reason: string;
    expiresInMs?: number;
  },
): Promise<AdapterResult<BootstrapIssueResult>> {
  const creds = requireOperatorBootstrapEnv();
  if (!creds.ok) {
    return { ok: false, error: creds.error, code: creds.code };
  }
  if (!input.reason.trim() || input.reason.trim().length < 8) {
    return {
      ok: false,
      error: "Bootstrap issue requires a substantive reason",
      code: "BOOTSTRAP_REASON_REQUIRED",
    };
  }
  const contact = input.intendedContactChannel.trim().toLowerCase();
  if (!contact.includes("@")) {
    return {
      ok: false,
      error: "Valid intended contact channel required",
      code: "BOOTSTRAP_CONTACT_INVALID",
    };
  }

  const rawToken = generateOpaqueToken(32);
  const tokenHash = hashToken(rawToken);
  const invitationId = newEntityId("invite");
  const expiresAt = new Date(Date.now() + (input.expiresInMs ?? DEFAULT_TTL_MS));

  try {
    await db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT id FROM operator_bootstrap_state WHERE id = ${BOOTSTRAP_STATE_ID} FOR UPDATE`,
      );
      const [state] = await tx
        .select()
        .from(operatorBootstrapState)
        .where(eq(operatorBootstrapState.id, BOOTSTRAP_STATE_ID))
        .limit(1);
      if (!state) {
        throw new Error("BOOTSTRAP_STATE_MISSING");
      }
      if (state.status === "completed") {
        throw new Error("BOOTSTRAP_ALREADY_COMPLETED");
      }
      if ((await countActiveAdministrators(tx)) > 0) {
        throw new Error("BOOTSTRAP_ADMINS_EXIST");
      }

      if (state.liveInvitationId) {
        await tx
          .update(invitations)
          .set({ status: "revoked", updatedAt: new Date() })
          .where(
            and(
              eq(invitations.id, state.liveInvitationId),
              eq(invitations.status, "pending"),
            ),
          );
      }

      await tx.insert(invitations).values({
        id: invitationId,
        tokenHash,
        intendedContactChannel: contact,
        status: "pending",
        kind: "administrator_bootstrap",
        synthetic: false,
        expiresAt,
        issuedByLabel: `operator:${creds.label}`,
        issuedByAccountId: null,
      });

      await tx
        .update(operatorBootstrapState)
        .set({
          status: "invitation_live",
          liveInvitationId: invitationId,
          lastOperatorLabel: creds.label,
          updatedAt: new Date(),
        })
        .where(eq(operatorBootstrapState.id, BOOTSTRAP_STATE_ID));

      await appendAuthAudit(tx, {
        actorRole: "environment_operator",
        actorAccountId: null,
        action: "operator.bootstrap_invitation_issued",
        subjectType: "invitation",
        subjectId: invitationId,
        summary: "First-administrator bootstrap invitation issued.",
        reason: input.reason.trim(),
        privatePayload: {
          invitationId,
          operatorLabel: creds.label,
          expiresAt: expiresAt.toISOString(),
        },
        synthetic: false,
        forbidSecrets: [rawToken, contact, creds.secret],
      });
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "BOOTSTRAP_ALREADY_COMPLETED") {
      return {
        ok: false,
        error: "First-administrator bootstrap already completed",
        code: message,
      };
    }
    if (message === "BOOTSTRAP_ADMINS_EXIST") {
      return {
        ok: false,
        error: "Administrators already exist; use ordinary role management",
        code: message,
      };
    }
    return {
      ok: false,
      error: "Bootstrap invitation issuance failed",
      code: "BOOTSTRAP_ISSUE_FAILED",
    };
  }

  return {
    ok: true,
    value: {
      invitationId,
      expiresAt: expiresAt.toISOString(),
      rawToken,
      acceptanceLink: `${resolveAppBaseUrl()}/auth/accept?token=${encodeURIComponent(rawToken)}`,
      operatorLabel: creds.label,
    },
  };
}

/**
 * Finalize first administrator: operator_bootstrap verification + activate + grant admin.
 */
export async function finalizeAdministratorBootstrap(
  db: FoundationDb,
  input: {
    reason: string;
    /** Substantive reason applied to each operator_bootstrap verification decision. */
    verificationReason: string;
  },
): Promise<AdapterResult<{ accountId: string }>> {
  const creds = requireOperatorBootstrapEnv();
  if (!creds.ok) {
    return { ok: false, error: creds.error, code: creds.code };
  }
  if (!input.reason.trim() || input.reason.trim().length < 8) {
    return {
      ok: false,
      error: "Bootstrap finalize requires a substantive reason",
      code: "BOOTSTRAP_REASON_REQUIRED",
    };
  }
  if (
    !input.verificationReason.trim() ||
    input.verificationReason.trim().length < 8
  ) {
    return {
      ok: false,
      error: "Each operator bootstrap verification decision needs a substantive reason",
      code: "BOOTSTRAP_VERIFICATION_REASON_REQUIRED",
    };
  }

  try {
    const accountId = await db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT id FROM operator_bootstrap_state WHERE id = ${BOOTSTRAP_STATE_ID} FOR UPDATE`,
      );
      const [state] = await tx
        .select()
        .from(operatorBootstrapState)
        .where(eq(operatorBootstrapState.id, BOOTSTRAP_STATE_ID))
        .limit(1);
      if (!state) {
        throw new Error("BOOTSTRAP_STATE_MISSING");
      }
      if (state.status === "completed") {
        throw new Error("BOOTSTRAP_ALREADY_COMPLETED");
      }
      if (state.status !== "invitation_live" || !state.liveInvitationId) {
        throw new Error("BOOTSTRAP_INVITATION_MISSING");
      }
      if ((await countActiveAdministrators(tx)) > 0) {
        throw new Error("BOOTSTRAP_ADMINS_EXIST");
      }

      const [invite] = await tx
        .select()
        .from(invitations)
        .where(eq(invitations.id, state.liveInvitationId))
        .limit(1);
      if (
        !invite ||
        invite.kind !== "administrator_bootstrap" ||
        invite.status !== "accepted" ||
        !invite.acceptedAccountId
      ) {
        throw new Error("BOOTSTRAP_CANDIDATE_NOT_ACCEPTED");
      }

      const accountId = invite.acceptedAccountId;
      const [account] = await tx
        .select()
        .from(accounts)
        .where(eq(accounts.id, accountId))
        .limit(1);
      if (!account?.contactVerifiedAt) {
        throw new Error("BOOTSTRAP_CONTACT_UNVERIFIED");
      }
      if (account.synthetic) {
        throw new Error("BOOTSTRAP_SYNTHETIC_FORBIDDEN");
      }

      const now = new Date();
      for (const kind of BOOTSTRAP_KINDS) {
        const [pendingCase] = await tx
          .select()
          .from(verificationCases)
          .where(
            and(
              eq(verificationCases.accountId, accountId),
              eq(verificationCases.kind, kind),
              eq(verificationCases.status, "pending"),
            ),
          )
          .limit(1);
        if (!pendingCase) {
          throw new Error(`BOOTSTRAP_ASSERTION_MISSING:${kind}`);
        }
        const assertions = await tx
          .select()
          .from(verificationAssertions)
          .where(eq(verificationAssertions.caseId, pendingCase.id));
        if (assertions.length === 0) {
          throw new Error(`BOOTSTRAP_ASSERTION_MISSING:${kind}`);
        }

        await tx
          .update(verificationCases)
          .set({
            status: "approved",
            decisionSource: "operator_bootstrap",
            operatorLabel: creds.label,
            reviewerAccountId: null,
            decisionReason: input.verificationReason.trim(),
            decidedAt: now,
            updatedAt: now,
          })
          .where(eq(verificationCases.id, pendingCase.id));

        await appendAuthAudit(tx, {
          actorRole: "environment_operator",
          actorAccountId: null,
          action: "operator.bootstrap_verification_recorded",
          subjectType: "verification_case",
          subjectId: pendingCase.id,
          summary: "Operator bootstrap verification decision recorded.",
          reason: input.verificationReason.trim(),
          privatePayload: {
            operatorLabel: creds.label,
            decisionSource: "operator_bootstrap" as const,
            kind,
            accountId,
          },
          synthetic: false,
          forbidSecrets: [creds.secret, invite.intendedContactChannel],
        });
      }

      const activated = await activateAccount(tx as unknown as FoundationDb, {
        accountId,
      });
      if (!activated.ok) {
        throw new Error(`BOOTSTRAP_ACTIVATION_FAILED:${activated.code}`);
      }

      const existingAdmin = await tx
        .select()
        .from(roleAssignments)
        .where(
          and(
            eq(roleAssignments.accountId, accountId),
            eq(roleAssignments.role, "administrator"),
            isNull(roleAssignments.revokedAt),
          ),
        )
        .limit(1);
      if (existingAdmin.length === 0) {
        await tx.insert(roleAssignments).values({
          id: newEntityId("role"),
          accountId,
          role: "administrator",
          grantedByLabel: `operator:${creds.label}`,
          reason: input.reason.trim(),
        });
      }

      // Re-check zero other admins — only this account may be admin.
      const admins = await tx
        .select()
        .from(roleAssignments)
        .where(
          and(
            eq(roleAssignments.role, "administrator"),
            isNull(roleAssignments.revokedAt),
          ),
        );
      if (
        admins.length !== 1 ||
        admins[0]?.accountId !== accountId
      ) {
        throw new Error("BOOTSTRAP_ADMIN_RACE");
      }

      await tx
        .update(operatorBootstrapState)
        .set({
          status: "completed",
          completedAccountId: accountId,
          completedAt: now,
          liveInvitationId: invite.id,
          lastOperatorLabel: creds.label,
          updatedAt: now,
        })
        .where(eq(operatorBootstrapState.id, BOOTSTRAP_STATE_ID));

      await appendAuthAudit(tx, {
        actorRole: "environment_operator",
        actorAccountId: null,
        action: "operator.bootstrap_administrator",
        subjectType: "account",
        subjectId: accountId,
        summary: "First administrator bootstrap completed.",
        reason: input.reason.trim(),
        privatePayload: {
          operatorLabel: creds.label,
          accountId,
          invitationId: invite.id,
        },
        synthetic: false,
        forbidSecrets: [creds.secret, invite.intendedContactChannel],
      });

      return accountId;
    });

    return { ok: true, value: { accountId } };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const known = [
      "BOOTSTRAP_ALREADY_COMPLETED",
      "BOOTSTRAP_ADMINS_EXIST",
      "BOOTSTRAP_INVITATION_MISSING",
      "BOOTSTRAP_CANDIDATE_NOT_ACCEPTED",
      "BOOTSTRAP_CONTACT_UNVERIFIED",
      "BOOTSTRAP_SYNTHETIC_FORBIDDEN",
      "BOOTSTRAP_ADMIN_RACE",
      "BOOTSTRAP_STATE_MISSING",
    ];
    if (known.includes(message) || message.startsWith("BOOTSTRAP_ASSERTION_MISSING") || message.startsWith("BOOTSTRAP_ACTIVATION_FAILED")) {
      return {
        ok: false,
        error: message.replace(/^BOOTSTRAP_/, "").replace(/_/g, " ").toLowerCase(),
        code: message.split(":")[0] ?? "BOOTSTRAP_FINALIZE_FAILED",
      };
    }
    return {
      ok: false,
      error: "Bootstrap finalization failed",
      code: "BOOTSTRAP_FINALIZE_FAILED",
    };
  }
}
