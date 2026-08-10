import { and, desc, eq, gt, isNull, lte } from "drizzle-orm";

import {
  accounts,
  authChallenges,
  authSessions,
  invitations,
  persons,
  profiles,
} from "@/db/schema";
import type { DrizzleTx } from "@/db/transaction-context";
import type { FoundationDb } from "@/db/types";
import type {
  AuthSession,
  ChallengeSent,
  InviteAcceptanceInput,
} from "@/lib/adapters/auth";
import type { EmailAdapter } from "@/lib/adapters/email";
import type { AdapterResult } from "@/lib/adapters/types";
import { appendAuthAudit } from "@/lib/auth/audit-log";
import { isSessionLifecycleAllowed } from "@/lib/auth/capabilities";
import { assertAllowedLifecycleTransition } from "@/lib/auth/lifecycle";
import { consumeRateLimit } from "@/lib/auth/rate-limit";
import { generateOpaqueToken, hashToken, newEntityId } from "@/lib/auth/tokens";

const CHALLENGE_TTL_MS = 30 * 60 * 1000;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const AUTH_RATE_LIMIT = 8;
const AUTH_RATE_WINDOW_MS = 15 * 60 * 1000;

export type AuthServiceDeps = {
  db: FoundationDb;
  email: EmailAdapter;
  /** Base URL for challenge links (no secrets). */
  appUrl: string;
  now?: () => Date;
};

export type EstablishedSession = AuthSession & {
  /** Raw session token for cookie establishment — never audit/log. */
  rawSessionToken: string;
};

function normalizeContact(contactChannel: string): string {
  return contactChannel.trim().toLowerCase();
}

function rateLimitOrThrow(action: string, key: string) {
  const result = consumeRateLimit(
    `${action}:${key}`,
    AUTH_RATE_LIMIT,
    AUTH_RATE_WINDOW_MS,
  );
  if (!result.ok) {
    return {
      ok: false as const,
      error: "Too many authentication attempts. Try again later.",
      code: "AUTH_RATE_LIMITED",
    };
  }
  return null;
}

export class AuthService {
  private readonly db: FoundationDb;
  private readonly email: EmailAdapter;
  private readonly appUrl: string;
  private readonly now: () => Date;

  constructor(deps: AuthServiceDeps) {
    this.db = deps.db;
    this.email = deps.email;
    this.appUrl = deps.appUrl.replace(/\/$/, "");
    this.now = deps.now ?? (() => new Date());
  }

  async acceptInvite(
    input: InviteAcceptanceInput,
  ): Promise<AdapterResult<ChallengeSent>> {
    const contactChannel = normalizeContact(input.contactChannel);
    const limited = rateLimitOrThrow("accept-invite", contactChannel);
    if (limited) {
      return limited;
    }

    const tokenHash = hashToken(input.inviteToken);
    const now = this.now();
    const personId = newEntityId("person");
    const accountId = newEntityId("account");
    const challengeId = newEntityId("challenge");
    const rawChallengeToken = generateOpaqueToken();

    type AcceptTxResult =
      | {
          kind: "accepted";
          inviteId: string;
          synthetic: boolean;
        }
      | { kind: "invalid" }
      | { kind: "expired" }
      | { kind: "contact_mismatch"; inviteId: string; synthetic: boolean };

    let txResult: AcceptTxResult;
    try {
      txResult = await this.db.transaction(async (tx) => {
        // Expire first when the token matches an overdue pending invite.
        const [expired] = await tx
          .update(invitations)
          .set({ status: "expired", updatedAt: now })
          .where(
            and(
              eq(invitations.tokenHash, tokenHash),
              eq(invitations.status, "pending"),
              lte(invitations.expiresAt, now),
            ),
          )
          .returning();
        if (expired) {
          return { kind: "expired" as const };
        }

        const [preview] = await tx
          .select()
          .from(invitations)
          .where(eq(invitations.tokenHash, tokenHash))
          .limit(1);

        if (!preview || preview.status !== "pending") {
          return { kind: "invalid" as const };
        }

        if (
          normalizeContact(preview.intendedContactChannel) !== contactChannel
        ) {
          return {
            kind: "contact_mismatch" as const,
            inviteId: preview.id,
            synthetic: preview.synthetic,
          };
        }

        const synthetic = preview.synthetic;

        await tx.insert(persons).values({
          id: personId,
          synthetic,
          displayLabel: synthetic
            ? `ostt-synth invitee ${accountId.slice(-6)}`
            : `account holder ${accountId.slice(-6)}`,
          notes: synthetic
            ? "Created via synthetic invitation acceptance (2.4)."
            : "Created via invitation acceptance (2.4).",
        });

        await tx.insert(accounts).values({
          id: accountId,
          personId,
          contactChannel,
          lifecycleState: "invited",
          synthetic,
        });

        await tx.insert(profiles).values({
          accountId,
          preferredDisplayName: synthetic
            ? `ostt-synth ${accountId.slice(-6)}`
            : `Participant ${accountId.slice(-6)}`,
        });

        const [claimed] = await tx
          .update(invitations)
          .set({
            status: "accepted",
            acceptedAt: now,
            acceptedAccountId: accountId,
            updatedAt: now,
          })
          .where(
            and(
              eq(invitations.tokenHash, tokenHash),
              eq(invitations.status, "pending"),
              gt(invitations.expiresAt, now),
            ),
          )
          .returning();

        if (!claimed) {
          // Concurrent claim won — roll back person/account inserts.
          throw new Error("INVITE_CLAIM_RACE");
        }

        await tx.insert(authChallenges).values({
          id: challengeId,
          accountId,
          contactChannel,
          purpose: "contact_verification",
          tokenHash: hashToken(rawChallengeToken),
          expiresAt: new Date(now.getTime() + CHALLENGE_TTL_MS),
        });

        await appendAuthAudit(tx, {
          actorRole: "invitee",
          actorAccountId: accountId,
          action: "auth.invite_accepted",
          subjectType: "invitation",
          subjectId: claimed.id,
          summary:
            "Invitation accepted; contact verification challenge created.",
          privatePayload: {
            accountId,
            lifecycleState: "invited",
            challengeId,
          },
          forbidSecrets: [input.inviteToken, rawChallengeToken],
          synthetic,
        });

        return {
          kind: "accepted" as const,
          inviteId: claimed.id,
          synthetic,
        };
      });
    } catch (error) {
      if (error instanceof Error && error.message === "INVITE_CLAIM_RACE") {
        await appendAuthAudit(this.db, {
          actorRole: "anonymous",
          action: "auth.invite_accept_rejected",
          subjectType: "invitation",
          subjectId: "unknown",
          summary: "Invite acceptance rejected (concurrent claim).",
          forbidSecrets: [input.inviteToken],
          synthetic: true,
        });
        return {
          ok: false,
          error: "Invitation is invalid or no longer usable.",
          code: "INVITE_INVALID",
        };
      }
      throw error;
    }

    if (txResult.kind === "invalid") {
      await appendAuthAudit(this.db, {
        actorRole: "anonymous",
        action: "auth.invite_accept_rejected",
        subjectType: "invitation",
        subjectId: "unknown",
        summary: "Invite acceptance rejected (missing or not pending).",
        forbidSecrets: [input.inviteToken],
        synthetic: true,
      });
      return {
        ok: false,
        error: "Invitation is invalid or no longer usable.",
        code: "INVITE_INVALID",
      };
    }

    if (txResult.kind === "expired") {
      return {
        ok: false,
        error: "Invitation has expired.",
        code: "INVITE_EXPIRED",
      };
    }

    if (txResult.kind === "contact_mismatch") {
      await appendAuthAudit(this.db, {
        actorRole: "anonymous",
        action: "auth.invite_accept_rejected",
        subjectType: "invitation",
        subjectId: txResult.inviteId,
        summary: "Invite acceptance rejected (contact channel mismatch).",
        forbidSecrets: [input.inviteToken],
        synthetic: txResult.synthetic,
      });
      return {
        ok: false,
        error: "Invitation contact channel does not match.",
        code: "INVITE_CONTACT_MISMATCH",
      };
    }

    return this.deliverChallengeEmail({
      accountId,
      contactChannel,
      purpose: "contact_verification",
      challengeId,
      rawToken: rawChallengeToken,
      synthetic: txResult.synthetic,
    });
  }

  /**
   * Re-issue a fresh contact-verification / sign-in / recovery challenge when
   * email delivery previously failed or the prior link was lost.
   * Consumes any still-open challenges for the contact in the same transaction.
   */
  async resendChallenge(
    contactChannelRaw: string,
  ): Promise<AdapterResult<ChallengeSent>> {
    const contactChannel = normalizeContact(contactChannelRaw);
    const limited = rateLimitOrThrow("resend-challenge", contactChannel);
    if (limited) {
      return limited;
    }

    const [account] = await this.db
      .select()
      .from(accounts)
      .where(eq(accounts.contactChannel, contactChannel))
      .limit(1);

    if (!account || !isSessionLifecycleAllowed(account.lifecycleState)) {
      // Uniform response — do not reveal account existence.
      return {
        ok: true,
        value: { status: "challenge_sent", contactChannel },
      };
    }

    const purpose =
      account.lifecycleState === "invited"
        ? ("contact_verification" as const)
        : ("sign_in" as const);

    return this.issueChallenge({
      accountId: account.id,
      contactChannel,
      purpose,
      synthetic: account.synthetic,
    });
  }

  async requestSignIn(
    contactChannelRaw: string,
  ): Promise<AdapterResult<ChallengeSent>> {
    const contactChannel = normalizeContact(contactChannelRaw);
    const limited = rateLimitOrThrow("sign-in", contactChannel);
    if (limited) {
      return limited;
    }

    const [account] = await this.db
      .select()
      .from(accounts)
      .where(eq(accounts.contactChannel, contactChannel))
      .limit(1);

    if (!account || !isSessionLifecycleAllowed(account.lifecycleState)) {
      await appendAuthAudit(this.db, {
        actorRole: "anonymous",
        action: "auth.sign_in_requested",
        subjectType: "contact_channel",
        subjectId: hashToken(contactChannel).slice(0, 16),
        summary: "Sign-in challenge requested (existence not disclosed).",
        synthetic: true,
      });
      return {
        ok: true,
        value: { status: "challenge_sent", contactChannel },
      };
    }

    return this.issueChallenge({
      accountId: account.id,
      contactChannel,
      purpose: "sign_in",
      synthetic: account.synthetic,
    });
  }

  async requestRecovery(
    contactChannelRaw: string,
  ): Promise<AdapterResult<ChallengeSent>> {
    const contactChannel = normalizeContact(contactChannelRaw);
    const limited = rateLimitOrThrow("recovery", contactChannel);
    if (limited) {
      return limited;
    }

    const [account] = await this.db
      .select()
      .from(accounts)
      .where(eq(accounts.contactChannel, contactChannel))
      .limit(1);

    if (!account || !isSessionLifecycleAllowed(account.lifecycleState)) {
      return {
        ok: true,
        value: { status: "challenge_sent", contactChannel },
      };
    }

    return this.issueChallenge({
      accountId: account.id,
      contactChannel,
      purpose: "recovery",
      synthetic: account.synthetic,
    });
  }

  async completeChallenge(
    rawToken: string,
  ): Promise<AdapterResult<EstablishedSession>> {
    const limited = rateLimitOrThrow(
      "complete-challenge",
      hashToken(rawToken).slice(0, 16),
    );
    if (limited) {
      return limited;
    }

    const tokenHash = hashToken(rawToken);
    const now = this.now();
    const rawSessionToken = generateOpaqueToken();
    const sessionId = newEntityId("session");

    try {
      const established = await this.db.transaction(async (tx) => {
        const [claimed] = await tx
          .update(authChallenges)
          .set({ consumedAt: now })
          .where(
            and(
              eq(authChallenges.tokenHash, tokenHash),
              isNull(authChallenges.consumedAt),
              gt(authChallenges.expiresAt, now),
            ),
          )
          .returning();

        if (!claimed || !claimed.accountId) {
          throw new Error("AUTH_CHALLENGE_INVALID");
        }

        const [account] = await tx
          .select()
          .from(accounts)
          .where(eq(accounts.id, claimed.accountId))
          .limit(1);

        if (!account || !isSessionLifecycleAllowed(account.lifecycleState)) {
          throw new Error("AUTH_ACCOUNT_DISABLED");
        }

        let lifecycleState = account.lifecycleState;
        if (claimed.purpose === "contact_verification") {
          assertAllowedLifecycleTransition(
            account.lifecycleState,
            "pending_onboarding",
          );
          await tx
            .update(accounts)
            .set({
              lifecycleState: "pending_onboarding",
              contactVerifiedAt: now,
              updatedAt: now,
            })
            .where(eq(accounts.id, account.id));
          lifecycleState = "pending_onboarding";
        } else {
          assertAllowedLifecycleTransition(lifecycleState, lifecycleState);
        }

        await tx.insert(authSessions).values({
          id: sessionId,
          accountId: account.id,
          sessionTokenHash: hashToken(rawSessionToken),
          expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
        });

        await appendAuthAudit(tx, {
          actorRole: "account_holder",
          actorAccountId: account.id,
          action: "auth.session_established",
          subjectType: "account",
          subjectId: account.id,
          summary: `Session established via ${claimed.purpose}.`,
          privatePayload: {
            purpose: claimed.purpose,
            lifecycleState,
            sessionId,
          },
          forbidSecrets: [rawToken, rawSessionToken],
          synthetic: account.synthetic,
        });

        return {
          accountId: account.id,
          lifecycleState,
          synthetic: account.synthetic,
          sessionId,
          rawSessionToken,
        } satisfies EstablishedSession;
      });

      return { ok: true, value: established };
    } catch (error) {
      if (error instanceof Error && error.message === "AUTH_CHALLENGE_INVALID") {
        await appendAuthAudit(this.db, {
          actorRole: "anonymous",
          action: "auth.challenge_rejected",
          subjectType: "auth_challenge",
          subjectId: "unknown",
          summary: "Auth challenge rejected (missing, consumed, or expired).",
          forbidSecrets: [rawToken],
          synthetic: true,
        });
        return {
          ok: false,
          error: "Challenge is invalid or expired.",
          code: "AUTH_CHALLENGE_INVALID",
        };
      }
      if (error instanceof Error && error.message === "AUTH_ACCOUNT_DISABLED") {
        return {
          ok: false,
          error: "This account cannot establish a session.",
          code: "AUTH_ACCOUNT_DISABLED",
        };
      }
      throw error;
    }
  }

  async getSessionByToken(
    rawSessionToken: string | null | undefined,
  ): Promise<AdapterResult<AuthSession | null>> {
    if (!rawSessionToken) {
      return { ok: true, value: null };
    }

    const tokenHash = hashToken(rawSessionToken);
    const [row] = await this.db
      .select({
        session: authSessions,
        account: accounts,
      })
      .from(authSessions)
      .innerJoin(accounts, eq(authSessions.accountId, accounts.id))
      .where(
        and(
          eq(authSessions.sessionTokenHash, tokenHash),
          isNull(authSessions.revokedAt),
          gt(authSessions.expiresAt, this.now()),
        ),
      )
      .limit(1);

    if (!row || !isSessionLifecycleAllowed(row.account.lifecycleState)) {
      return { ok: true, value: null };
    }

    return {
      ok: true,
      value: {
        accountId: row.account.id,
        lifecycleState: row.account.lifecycleState,
        synthetic: row.account.synthetic,
        sessionId: row.session.id,
      },
    };
  }

  async signOut(input: {
    rawSessionToken?: string | null;
    sessionId?: string | null;
  }): Promise<AdapterResult<true>> {
    let sessionId = input.sessionId ?? null;
    const forbidSecrets = input.rawSessionToken ? [input.rawSessionToken] : [];

    if (!sessionId && input.rawSessionToken) {
      const tokenHash = hashToken(input.rawSessionToken);
      const [session] = await this.db
        .select()
        .from(authSessions)
        .where(eq(authSessions.sessionTokenHash, tokenHash))
        .limit(1);
      sessionId = session?.id ?? null;
    }

    if (!sessionId) {
      return { ok: true, value: true };
    }

    await this.db.transaction(async (tx) => {
      const [session] = await tx
        .select()
        .from(authSessions)
        .where(eq(authSessions.id, sessionId!))
        .limit(1);

      if (!session || session.revokedAt) {
        return;
      }

      const synthetic = await this.syntheticForAccount(tx, session.accountId);

      await tx
        .update(authSessions)
        .set({ revokedAt: this.now() })
        .where(
          and(eq(authSessions.id, session.id), isNull(authSessions.revokedAt)),
        );

      await appendAuthAudit(tx, {
        actorRole: "account_holder",
        actorAccountId: session.accountId,
        action: "auth.sign_out",
        subjectType: "auth_session",
        subjectId: session.id,
        summary: "Session signed out.",
        forbidSecrets,
        synthetic,
      });
    });

    return { ok: true, value: true };
  }

  async revokeAllSessions(accountId: string): Promise<AdapterResult<true>> {
    await this.db.transaction(async (tx) => {
      const synthetic = await this.syntheticForAccount(tx, accountId);

      await tx
        .update(authSessions)
        .set({ revokedAt: this.now() })
        .where(
          and(
            eq(authSessions.accountId, accountId),
            isNull(authSessions.revokedAt),
          ),
        );

      await appendAuthAudit(tx, {
        actorRole: "account_holder",
        actorAccountId: accountId,
        action: "auth.revoke_all_sessions",
        subjectType: "account",
        subjectId: accountId,
        summary: "All sessions revoked (sign out everywhere).",
        synthetic,
      });
    });

    return { ok: true, value: true };
  }

  private async syntheticForAccount(
    tx: DrizzleTx | FoundationDb,
    accountId: string,
  ): Promise<boolean> {
    const [account] = await tx
      .select({ synthetic: accounts.synthetic })
      .from(accounts)
      .where(eq(accounts.id, accountId))
      .limit(1);
    if (!account) {
      throw new Error(`Cannot classify audit: unknown account ${accountId}`);
    }
    return account.synthetic;
  }

  private async issueChallenge(input: {
    accountId: string;
    contactChannel: string;
    purpose: "contact_verification" | "sign_in" | "recovery";
    synthetic: boolean;
  }): Promise<AdapterResult<ChallengeSent>> {
    const now = this.now();
    const rawToken = generateOpaqueToken();
    const challengeId = newEntityId("challenge");

    await this.db.transaction(async (tx) => {
      // Invalidate prior open challenges for this contact/purpose so resend is safe.
      await tx
        .update(authChallenges)
        .set({ consumedAt: now })
        .where(
          and(
            eq(authChallenges.contactChannel, input.contactChannel),
            eq(authChallenges.purpose, input.purpose),
            isNull(authChallenges.consumedAt),
          ),
        );

      await tx.insert(authChallenges).values({
        id: challengeId,
        accountId: input.accountId,
        contactChannel: input.contactChannel,
        purpose: input.purpose,
        tokenHash: hashToken(rawToken),
        expiresAt: new Date(now.getTime() + CHALLENGE_TTL_MS),
      });

      await appendAuthAudit(tx, {
        actorRole: "system",
        actorAccountId: input.accountId,
        action: "auth.challenge_issued",
        subjectType: "auth_challenge",
        subjectId: challengeId,
        summary: `Challenge issued for ${input.purpose}.`,
        privatePayload: { purpose: input.purpose },
        forbidSecrets: [rawToken],
        synthetic: input.synthetic,
      });
    });

    return this.deliverChallengeEmail({
      accountId: input.accountId,
      contactChannel: input.contactChannel,
      purpose: input.purpose,
      challengeId,
      rawToken,
      synthetic: input.synthetic,
    });
  }

  private async deliverChallengeEmail(input: {
    accountId: string;
    contactChannel: string;
    purpose: "contact_verification" | "sign_in" | "recovery";
    challengeId: string;
    rawToken: string;
    synthetic: boolean;
  }): Promise<AdapterResult<ChallengeSent>> {
    const link = `${this.appUrl}/auth/complete?token=${encodeURIComponent(input.rawToken)}`;
    const sent = await this.email.send({
      to: input.contactChannel,
      subject: "Your Open-Source Think Tank sign-in link",
      textBody: [
        "Use this one-time link to continue. It expires in 30 minutes.",
        link,
        "",
        "If you did not request this, ignore this message.",
      ].join("\n"),
    });

    if (!sent.ok) {
      await appendAuthAudit(this.db, {
        actorRole: "system",
        actorAccountId: input.accountId,
        action: "auth.challenge_email_failed",
        subjectType: "auth_challenge",
        subjectId: input.challengeId,
        summary: `Challenge email delivery failed for ${input.purpose}; resend available.`,
        privatePayload: {
          purpose: input.purpose,
          deliveryCode: sent.code,
        },
        forbidSecrets: [input.rawToken],
        synthetic: input.synthetic,
      });

      return {
        ok: true,
        value: {
          status: "challenge_pending_delivery",
          contactChannel: input.contactChannel,
        },
      };
    }

    await appendAuthAudit(this.db, {
      actorRole: "system",
      actorAccountId: input.accountId,
      action: "auth.challenge_email_sent",
      subjectType: "auth_challenge",
      subjectId: input.challengeId,
      summary: `Challenge email sent for ${input.purpose}.`,
      privatePayload: {
        purpose: input.purpose,
        emailMessageId: sent.value.messageId,
      },
      forbidSecrets: [input.rawToken],
      synthetic: input.synthetic,
    });

    return {
      ok: true,
      value: { status: "challenge_sent", contactChannel: input.contactChannel },
    };
  }
}

/** Test helper: latest open challenge token is not exposed; use CaptureEmailAdapter. */
export async function countOpenChallenges(
  db: FoundationDb,
  contactChannel: string,
): Promise<number> {
  const rows = await db
    .select()
    .from(authChallenges)
    .where(
      and(
        eq(authChallenges.contactChannel, contactChannel),
        isNull(authChallenges.consumedAt),
      ),
    )
    .orderBy(desc(authChallenges.createdAt));
  return rows.length;
}
