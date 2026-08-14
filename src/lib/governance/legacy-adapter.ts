/**
 * Read-only characterization of legacy think-tank artifacts.
 * Never mints v2 Chamber/Council authority or inserts governance records
 * from production-looking alpha data.
 */

export type LegacyTopicCharacterization = {
  v2PublicAgenda: false;
  v2Authority: false;
  legacyWorkflowState: string;
};

export type LegacyCouncilCharacterization = {
  v2Authority: false;
  legacySeat: true;
  councilRole: "deliberation_council" | "policy_council";
};

export function characterizeLegacyTopic(workflowState: string): LegacyTopicCharacterization {
  return {
    v2PublicAgenda: false,
    v2Authority: false,
    legacyWorkflowState: workflowState,
  };
}

export function characterizeLegacyCouncilAppointment(
  councilRole: "deliberation_council" | "policy_council",
): LegacyCouncilCharacterization {
  return {
    v2Authority: false,
    legacySeat: true,
    councilRole,
  };
}

export function legacySeatSatisfiesOrganizationGovernance(): false {
  return false;
}
