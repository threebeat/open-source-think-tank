import type { AccountLifecycleState, AdapterResult } from "@/lib/adapters/types";

export type AuthSession = {
  accountId: string;
  lifecycleState: AccountLifecycleState;
  /** Synthetic marker for test/demo accounts — real participants must be false. */
  synthetic: boolean;
  sessionId: string;
};

export type InviteAcceptanceInput = {
  inviteToken: string;
  contactChannel: string;
};

export type ChallengeSent = {
  /** `challenge_pending_delivery` means the challenge exists; caller may resend. */
  status: "challenge_sent" | "challenge_pending_delivery";
  contactChannel: string;
};

/**
 * Authentication boundary (ADR 0004). Must not set real participants to `active`.
 */
export interface AuthAdapter {
  readonly name: "auth";
  getSession(): Promise<AdapterResult<AuthSession | null>>;
  acceptInvite(
    input: InviteAcceptanceInput,
  ): Promise<AdapterResult<ChallengeSent>>;
  completeChallenge(token: string): Promise<AdapterResult<AuthSession>>;
  requestSignIn(contactChannel: string): Promise<AdapterResult<ChallengeSent>>;
  requestRecovery(contactChannel: string): Promise<AdapterResult<ChallengeSent>>;
  resendChallenge(contactChannel: string): Promise<AdapterResult<ChallengeSent>>;
  signOut(): Promise<AdapterResult<true>>;
  revokeAllSessions(accountId: string): Promise<AdapterResult<true>>;
}

export class PublicDemoAuthAdapter implements AuthAdapter {
  readonly name = "auth" as const;

  async getSession(): Promise<AdapterResult<AuthSession | null>> {
    return { ok: true, value: null };
  }

  async acceptInvite(
    _input: InviteAcceptanceInput,
  ): Promise<AdapterResult<ChallengeSent>> {
    return {
      ok: false,
      error: "Authentication is disabled in public-demo mode",
      code: "PUBLIC_DEMO_NO_AUTH",
    };
  }

  async completeChallenge(
    _token: string,
  ): Promise<AdapterResult<AuthSession>> {
    return {
      ok: false,
      error: "Authentication is disabled in public-demo mode",
      code: "PUBLIC_DEMO_NO_AUTH",
    };
  }

  async requestSignIn(
    _contactChannel: string,
  ): Promise<AdapterResult<ChallengeSent>> {
    return {
      ok: false,
      error: "Authentication is disabled in public-demo mode",
      code: "PUBLIC_DEMO_NO_AUTH",
    };
  }

  async requestRecovery(
    _contactChannel: string,
  ): Promise<AdapterResult<ChallengeSent>> {
    return {
      ok: false,
      error: "Authentication is disabled in public-demo mode",
      code: "PUBLIC_DEMO_NO_AUTH",
    };
  }

  async resendChallenge(
    _contactChannel: string,
  ): Promise<AdapterResult<ChallengeSent>> {
    return {
      ok: false,
      error: "Authentication is disabled in public-demo mode",
      code: "PUBLIC_DEMO_NO_AUTH",
    };
  }

  async signOut(): Promise<AdapterResult<true>> {
    return { ok: true, value: true };
  }

  async revokeAllSessions(
    _accountId: string,
  ): Promise<AdapterResult<true>> {
    return {
      ok: false,
      error: "Authentication is disabled in public-demo mode",
      code: "PUBLIC_DEMO_NO_AUTH",
    };
  }
}
