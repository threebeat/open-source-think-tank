import { describe, expect, it } from "vitest";

import {
  characterizeLegacyCouncilAppointment,
  characterizeLegacyTopic,
  legacySeatSatisfiesOrganizationGovernance,
} from "@/lib/governance/legacy-adapter";

describe("legacy adapter", () => {
  it("does not treat old topics as v2 public agenda", () => {
    for (const state of [
      "draft",
      "open_for_submissions",
      "under_review",
      "paused",
      "archived",
    ]) {
      expect(characterizeLegacyTopic(state)).toEqual({
        v2PublicAgenda: false,
        v2Authority: false,
        legacyWorkflowState: state,
      });
    }
  });

  it("does not mint v2 Chamber/Council authority from legacy seats", () => {
    expect(
      characterizeLegacyCouncilAppointment("deliberation_council"),
    ).toEqual({
      v2Authority: false,
      legacySeat: true,
      councilRole: "deliberation_council",
    });
    expect(characterizeLegacyCouncilAppointment("policy_council").v2Authority).toBe(
      false,
    );
    expect(legacySeatSatisfiesOrganizationGovernance()).toBe(false);
  });
});
