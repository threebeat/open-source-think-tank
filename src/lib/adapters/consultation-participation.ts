import type { AdapterResult } from "@/lib/adapters/types";

/**
 * Conversation-scoped pseudonym foundation (package 2.10).
 * No live Pol.is in Phase 2.
 */
export interface ConsultationParticipationAdapter {
  readonly name: "consultation-participation";
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
