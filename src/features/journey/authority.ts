/**
 * Pre-deliberation authority limits for Phase 4.1.
 * Product/engineering rules — not legal clearance.
 */

export type PreDeliberationActor =
  | "visitor"
  | "community_participant"
  | "moderator"
  | "administrator"
  | "board_member"
  | "deliberation_council"
  | "policy_council";

export type PreDeliberationAction =
  | "idea_commons_post"
  | "ordinary_proposal"
  | "moderation_safety"
  | "moderation_relevance"
  | "moderation_duplication"
  | "moderation_formatting"
  | "moderation_process"
  | "assign_agenda_priority"
  | "privately_promote_proposal"
  | "direct_promote_pre_deliberation_topic"
  | "alter_consultation_metrics"
  | "elevated_badge_on_ordinary_contribution";

const allowed: Record<PreDeliberationActor, PreDeliberationAction[]> = {
  visitor: ["idea_commons_post", "ordinary_proposal"],
  community_participant: ["idea_commons_post", "ordinary_proposal"],
  moderator: [
    "idea_commons_post",
    "ordinary_proposal",
    "moderation_safety",
    "moderation_relevance",
    "moderation_duplication",
    "moderation_formatting",
    "moderation_process",
  ],
  administrator: ["idea_commons_post", "ordinary_proposal"],
  board_member: ["idea_commons_post", "ordinary_proposal"],
  deliberation_council: [],
  policy_council: [],
};

export function canPerformPreDeliberationAction(
  actor: PreDeliberationActor,
  action: PreDeliberationAction,
): boolean {
  return allowed[actor]?.includes(action) ?? false;
}

export function promotionActionsForbidden(): PreDeliberationAction[] {
  return [
    "assign_agenda_priority",
    "privately_promote_proposal",
    "direct_promote_pre_deliberation_topic",
    "alter_consultation_metrics",
    "elevated_badge_on_ordinary_contribution",
  ];
}

export function assertNoPrivilegedPromotion(
  actor: PreDeliberationActor,
  action: PreDeliberationAction,
): { ok: true } | { ok: false; reason: string } {
  if (promotionActionsForbidden().includes(action)) {
    return {
      ok: false,
      reason:
        "No moderator, administrator, board member, or individual participant may directly promote a pre-deliberation topic based on preference, assign agenda priority, privately promote a proposal, alter consultation metrics, or receive elevated ranking badges on ordinary contributions.",
    };
  }
  if (!canPerformPreDeliberationAction(actor, action)) {
    return {
      ok: false,
      reason: `Actor ${actor} cannot perform ${action} before formal deliberation.`,
    };
  }
  return { ok: true };
}

export const moderatorInterventionRequiresReason = true;

export const ordinaryContributionRules = {
  sameInterface: true,
  elevatedBadgesAllowed: false,
  rankingAdvantageAllowed: false,
  privilegedPromotionPath: false,
} as const;
