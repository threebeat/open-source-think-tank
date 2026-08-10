import { and, eq, gt, isNull } from "drizzle-orm";

import {
  accounts,
  authChallenges,
  authSessions,
  invitations,
  persons,
  profiles,
} from "@/db/schema";
import type { FoundationDb } from "@/db/types";
import type {
  AuthSession,
  ChallengeSent,
  InviteAcceptanceInput,
} from "@/lib/adapters/auth";
import type { AdapterResult } from "@/lib/adapters/types";
import { appendAuthAudit } from "@/lib/auth/audit-log";
import { isSessionLifecycleAllowed } from "@/lib/auth/capabilities";
import { assertAllowedLifecycleTransition } from "@/lib/auth/lifecycle";
import { consumeRateLimit } from "@/lib/auth/rate-limit";
import { generateOpaqueToken, hashToken, newEntityId } from "@/lib/auth/tokens";
import type { EmailAdapter } from "@/lib/adapters/email";

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
    const [invite] = await this.db
      .select()
      .from(invitations)
      .where(eq(invitations.tokenHash, tokenHash))
      .limit(1);

    if (!invite || invite.status !== "pending") {
      await appendAuthAudit(this.db, {
        actorRole: "anonymous",
        action: "auth.invite_accept_rejected",
        subjectType: "invitation",
        subjectId: "unknown",
        summary: "Invite acceptance rejected (missing or not pending).",
        forbidSecrets: [input.inviteToken],
      });
      return {
        ok: false,
        error: "Invitation is invalid or no longer usable.",
        code: "INVITE_INVALID",
      };
    }

    if (invite.expiresAt.getTime() <= this.now().getTime()) {
      await this.db
        .update(invitations)
        .set({ status: "expired", updatedAt: this.now() })
        .where(eq(invitations.id, invite.id));
      return {
        ok: false,
        error: "Invitation has expired.",
        code: "INVITE_EXPIRED",
      };
    }

    if (
      normalizeContact(invite.intendedContactChannel) !== contactChannel
    ) {
      await appendAuthAudit(this.db, {
        actorRole: "anonymous",
        action: "auth.invite_accept_rejected",
        subjectType: "invitation",
        subjectId: invite.id,
        summary: "Invite acceptance rejected (contact channel mismatch).",
        forbidSecrets: [input.inviteToken],
      });
      return {
        ok: false,
        error: "Invitation contact channel does not match.",
        code: "INVITE_CONTACT_MISMATCH",
      };
    }

    const personId = newEntityId("person");
    const accountId = newEntityId("account");
    const synthetic = invite.synthetic;

    await this.db.insert(persons).values({
      id: personId,
      synthetic,
      displayLabel: synthetic
        ? `ostt-synth invitee ${accountId.slice(-6)}`
        : `account holder ${accountId.slice(-6)}`,
      notes: synthetic
        ? "Created via synthetic invitation acceptance (2.4)."
        : "Created via invitation acceptance (2.4).",
    });

    await this.db.insert(accounts).values({
      id: accountId,
      personId,
      contactChannel,
      lifecycleState: "invited",
      synthetic,
    });

    await this.db.insert(profiles).values({
      accountId,
      preferredDisplayName: synthetic
        ? `ostt-synth ${accountId.slice(-6)}`
        : `Participant ${accountId.slice(-6)}`,
    });

    await this.db
      .update(invitations)
      .set({
        status: "accepted",
        acceptedAt: this.now(),
        acceptedAccountId: accountId,
        updatedAt: this.now(),
      })
      .where(eq(invitations.id, invite.id));

    await appendAuthAudit(this.db, {
      actorRole: "invitee",
      actorAccountId: accountId,
      action: "auth.invite_accepted",
      subjectType: "invitation",
      subjectId: invite.id,
      summary: "Invitation accepted; contact verification challenge issued.",
      privatePayload: { accountId, lifecycleState: "invited" },
      forbidSecrets: [input.inviteToken],
      synthetic,
    });

    return this.issueChallenge({
      accountId,
      contactChannel,
      purpose: "contact_verification",
      synthetic,
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
      // Uniform response — do not reveal whether the contact exists.
      await appendAuthAudit(this.db, {
        actorRole: "anonymous",
        action: "auth.sign_in_requested",
        subjectType: "contact_channel",
        subjectId: hashToken(contactChannel).slice(0, 16),
        summary: "Sign-in challenge requested (existence not disclosed).",
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
    const limited = rateLimitOrThrow("complete-challenge", hashToken(rawToken).slice(0, 16));
    if (limited) {
      return limited;
    }

    const tokenHash = hashToken(rawToken);
    const [challenge] = await this.db
      .select()
      .from(authChallenges)
      .where(eq(authChallenges.tokenHash, tokenHash))
      .limit(1);

    if (
      !challenge ||
      challenge.consumedAt ||
      challenge.expiresAt.getTime() <= this.now().getTime()
    ) {
      await appendAuthAudit(this.db, {
        actorRole: "anonymous",
        action: "auth.challenge_rejected",
        subjectType: "auth_challenge",
        subjectId: "unknown",
        summary: "Auth challenge rejected (missing, consumed, or expired).",
        forbidSecrets: [rawToken],
      });
      return {
        ok: false,
        error: "Challenge is invalid or expired.",
        code: "AUTH_CHALLENGE_INVALID",
      };
    }

    if (!challenge.accountId) {
      return {
        ok: false,
        error: "Challenge is invalid or expired.",
        code: "AUTH_CHALLENGE_INVALID",
      };
    }

    const [account] = await this.db
      .select()
      .from(accounts)
      .where(eq(accounts.id, challenge.accountId))
      .limit(1);

    if (!account || !isSessionLifecycleAllowed(account.lifecycleState)) {
      return {
        ok: false,
        error: "This account cannot establish a session.",
        code: "AUTH_ACCOUNT_DISABLED",
      };
    }

    await this.db
      .update(authChallenges)
      .set({ consumedAt: this.now() })
      .where(eq(authChallenges.id, challenge.id));

    let lifecycleState = account.lifecycleState;
    if (challenge.purpose === "contact_verification") {
      assertAllowedLifecycleTransition(account.lifecycleState, "pending_onboarding");
      await this.db
        .update(accounts)
        .set({
          lifecycleState: "pending_onboarding",
          contactVerifiedAt: this.now(),
          updatedAt: this.now(),
        })
        .where(eq(accounts.id, account.id));
      lifecycleState = "pending_onboarding";
    }

    // Recovery and sign-in renew a session but never activate.
    assertAllowedLifecycleTransition(lifecycleState, lifecycleState);

    const established = await this.createSessionRow({
      accountId: account.id,
      lifecycleState,
      synthetic: account.synthetic,
    });

    await appendAuthAudit(this.db, {
      actorRole: "account_holder",
      actorAccountId: account.id,
      action: "auth.session_established",
      subjectType: "account",
      subjectId: account.id,
      summary: `Session established via ${challenge.purpose}.`,
      privatePayload: {
        purpose: challenge.purpose,
        lifecycleState,
        sessionId: established.sessionId,
      },
      forbidSecrets: [rawToken, established.rawSessionToken],
      synthetic: account.synthetic,
    });

    return { ok: true, value: established };
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

    const [session] = await this.db
      .select()
      .from(authSessions)
      .where(eq(authSessions.id, sessionId))
      .limit(1);

    if (session && !session.revokedAt) {
      await this.db
        .update(authSessions)
        .set({ revokedAt: this.now() })
        .where(eq(authSessions.id, session.id));
      await appendAuthAudit(this.db, {
        actorRole: "account_holder",
        actorAccountId: session.accountId,
        action: "auth.sign_out",
        subjectType: "auth_session",
        subjectId: session.id,
        summary: "Session signed out.",
        forbidSecrets,
      });
    }
    return { ok: true, value: true };
  }

  async revokeAllSessions(accountId: string): Promise<AdapterResult<true>> {
    await this.db
      .update(authSessions)
      .set({ revokedAt: this.now() })
      .where(
        and(eq(authSessions.accountId, accountId), isNull(authSessions.revokedAt)),
      );

    await appendAuthAudit(this.db, {
      actorRole: "account_holder",
      actorAccountId: accountId,
      action: "auth.revoke_all_sessions",
      subjectType: "account",
      subjectId: accountId,
      summary: "All sessions revoked (sign out everywhere).",
    });

    return { ok: true, value: true };
  }

  private async issueChallenge(input: {
    accountId: string;
    contactChannel: string;
    purpose: "contact_verification" | "sign_in" | "recovery";
    synthetic: boolean;
  }): Promise<AdapterResult<ChallengeSent>> {
    const rawToken = generateOpaqueToken();
    const challengeId = newEntityId("challenge");
    await this.db.insert(authChallenges).values({
      id: challengeId,
      accountId: input.accountId,
      contactChannel: input.contactChannel,
      purpose: input.purpose,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(this.now().getTime() + CHALLENGE_TTL_MS),
    });

    const link = `${this.appUrl}/auth/complete?token=${encodeURIComponent(rawToken)}`;
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
      return {
        ok: false,
        error: sent.error,
        code: sent.code,
      };
    }

    await appendAuthAudit(this.db, {
      actorRole: "system",
      actorAccountId: input.accountId,
      action: "auth.challenge_issued",
      subjectType: "auth_challenge",
      subjectId: challengeId,
      summary: `Challenge issued for ${input.purpose}.`,
      privatePayload: { purpose: input.purpose, emailMessageId: sent.value.messageId },
      forbidSecrets: [rawToken],
      synthetic: input.synthetic,
    });

    return {
      ok: true,
      value: { status: "challenge_sent", contactChannel: input.contactChannel },
    };
  }

  private async createSessionRow(input: {
    accountId: string;
    lifecycleState: AuthSession["lifecycleState"];
    synthetic: boolean;
  }): Promise<EstablishedSession> {
    const rawSessionToken = generateOpaqueToken();
    const sessionId = newEntityId("session");
    await this.db.insert(authSessions).values({
      id: sessionId,
      accountId: input.accountId,
      sessionTokenHash: hashToken(rawSessionToken),
      expiresAt: new Date(this.now().getTime() + SESSION_TTL_MS),
    });

    return {
      accountId: input.accountId,
      lifecycleState: input.lifecycleState,
      synthetic: input.synthetic,
      sessionId,
      rawSessionToken,
    };
  }
}
