import { describe, expect, it } from "vitest";

import {
  formalTopicGateViews,
  ideaCommonsPosts,
  journeyCatalog,
  journeyTrajectories,
  memberActionOpportunities,
  qualificationTraces,
} from "@/fixtures/journey-catalog";

describe("phase 4.1 journey catalog", () => {
  it("marks the catalog synthetic and includes three trajectories", () => {
    expect(journeyCatalog.synthetic).toBe(true);
    expect(journeyTrajectories).toHaveLength(3);
    expect(journeyTrajectories.map((item) => item.outcome).sort()).toEqual([
      "advances",
      "deferred",
      "merge_split",
    ]);
  });

  it("keeps Idea Commons posts informal", () => {
    for (const post of ideaCommonsPosts) {
      expect(post.synthetic).toBe(true);
      expect(post.informalNotice).toMatch(/not yet in the Formal Topic Pipeline/i);
    }
    expect(
      ideaCommonsPosts.some((post) => post.id === "idea-moderator-ordinary-proposal"),
    ).toBe(true);
  });

  it("requires formal gate views to expose criteria and lineage", () => {
    for (const gate of formalTopicGateViews) {
      expect(gate.area).toBe("formal_topic_pipeline");
      expect(gate.criteriaMet.length).toBeGreaterThan(0);
      expect(gate.lineage.length).toBeGreaterThan(0);
      expect(gate.whoCanActNow.length).toBeGreaterThan(0);
    }
  });

  it("keeps qualification signals independent with human review provenance", () => {
    for (const trace of qualificationTraces) {
      expect(trace.signals.length).toBeGreaterThanOrEqual(8);
      expect(new Set(trace.signals.map((signal) => signal.id)).size).toBe(
        trace.signals.length,
      );
      expect(trace.humanReview.publicReason.length).toBeGreaterThan(0);
      expect(trace.humanReview.methodVersion).toBe(trace.methodVersion);
      expect(
        trace.notices.some(
          (notice) =>
            /no single composite/i.test(notice) ||
            /consultation metrics were not edited/i.test(notice) ||
            /human deferral records reason/i.test(notice),
        ),
      ).toBe(true);
    }
  });

  it("requires member actions to declare non-personalization basis", () => {
    expect(memberActionOpportunities.length).toBeGreaterThanOrEqual(5);
    for (const action of memberActionOpportunities) {
      expect(action.whyShown).toMatch(
        /fixture|explicit|interest|geography|lineage|tag/i,
      );
      expect(action.whyShown).not.toMatch(
        /personalized from (your|their) (polis|pol\.is|vote)/i,
      );
      expect(action.sponsorshipConflict.length).toBeGreaterThan(0);
      expect(action.nonEndorsement.length).toBeGreaterThan(0);
      expect(action.relationshipToRecommendation.length).toBeGreaterThan(0);
    }
  });
});
