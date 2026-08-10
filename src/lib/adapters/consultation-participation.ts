import type { AdapterResult } from "@/lib/adapters/types";

/**
 * Conversation-scoped pseudonym foundation (package 2.10).
 * No live Pol.is in Phase 2. Reverse mapping is intentionally absent.
 */
export interface ConsultationParticipationAdapter {
  readonly name: "consultation-participation";
  /**
   * Issue (or reuse active) opaque pseudonym for an account in a conversation.
   * Providers receive only `{ pseudonym }` — never account identifiers.
   */
  issuePseudonym(
    accountId: string,
    conversationId: string,
  ): Promise<AdapterResult<{ pseudonym: string }>>;
}

export class ForbiddenConsultationParticipationAdapter
  implements ConsultationParticipationAdapter
{
  readonly name = "consultation-participation" as const;

  async issuePseudonym(
    _accountId: string,
    _conversationId: string,
  ): Promise<AdapterResult<{ pseudonym: string }>> {
    return {
      ok: false,
      error: "Live consultation participation is forbidden in Phase 2",
      code: "PHASE2_NO_LIVE_CONSULTATION",
    };
  }
}
