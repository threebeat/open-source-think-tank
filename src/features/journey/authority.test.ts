import { describe, expect, it } from "vitest";

import {
  assertNoPrivilegedPromotion,
  canPerformPreDeliberationAction,
  ordinaryContributionRules,
  promotionActionsForbidden,
} from "@/features/journey/authority";

describe("pre-deliberation authority limits", () => {
  it("forbids preference-based promotion for every elevated actor", () => {
    for (const action of promotionActionsForbidden()) {
      for (const actor of [
        "moderator",
        "administrator",
        "board_member",
        "community_participant",
      ] as const) {
        const result = assertNoPrivilegedPromotion(actor, action);
        expect(result.ok).toBe(false);
      }
    }
  });

  it("allows moderators only process/safety-style interventions", () => {
    expect(canPerformPreDeliberationAction("moderator", "moderation_safety")).toBe(
      true,
    );
    expect(
      canPerformPreDeliberationAction("moderator", "assign_agenda_priority"),
    ).toBe(false);
    expect(
      canPerformPreDeliberationAction("moderator", "ordinary_proposal"),
    ).toBe(true);
  });

  it("keeps ordinary contributions without elevated ranking advantages", () => {
    expect(ordinaryContributionRules.elevatedBadgesAllowed).toBe(false);
    expect(ordinaryContributionRules.rankingAdvantageAllowed).toBe(false);
    expect(ordinaryContributionRules.privilegedPromotionPath).toBe(false);
  });
});
