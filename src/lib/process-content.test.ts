import { describe, expect, it } from "vitest";

import { processStages } from "@/lib/process-content";

describe("processStages", () => {
  it("covers seven stages with board-authority caution in the decision stage", () => {
    expect(processStages).toHaveLength(7);
    for (const stage of processStages) {
      expect(stage.whoParticipates.length).toBeGreaterThan(0);
      expect(stage.whatHappens.length).toBeGreaterThan(0);
      expect(stage.whatIsProduced.length).toBeGreaterThan(0);
      expect(stage.whatBecomesPublic.length).toBeGreaterThan(0);
    }
    const decision = processStages.find((stage) => stage.id === "decision");
    expect(decision?.whoParticipates).toMatch(/pending counsel/i);
  });
});
