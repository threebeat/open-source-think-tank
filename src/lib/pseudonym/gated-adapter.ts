import type { FoundationDb } from "@/db/types";
import type { ConsultationParticipationAdapter } from "@/lib/adapters/consultation-participation";
import type { AdapterResult } from "@/lib/adapters/types";
import { issueConversationPseudonym } from "@/lib/pseudonym/service";

/**
 * Gated consultation-participation adapter — issues opaque pseudonyms only.
 * No live Pol.is. Does not expose reverse mapping.
 */
export class GatedConsultationParticipationAdapter
  implements ConsultationParticipationAdapter
{
  readonly name = "consultation-participation" as const;

  constructor(private readonly db: FoundationDb) {}

  async issuePseudonym(
    accountId: string,
    conversationId: string,
  ): Promise<AdapterResult<{ pseudonym: string }>> {
    const result = await issueConversationPseudonym(this.db, {
      accountId,
      conversationId,
      actorAccountId: accountId,
    });
    if (!result.ok) {
      return result;
    }
    return { ok: true, value: { pseudonym: result.value.pseudonym } };
  }
}
