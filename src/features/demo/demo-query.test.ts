import { describe, expect, it } from "vitest";

import {
  demoReturnHref,
  getDemoContinueHref,
  getNextDemoStepId,
  withDemoStep,
} from "@/features/demo/demo-query";

describe("demo-query", () => {
  it("appends demoStep without dropping existing query or hash", () => {
    expect(withDemoStep("/join", "join")).toBe("/join?demoStep=join");
    expect(
      withDemoStep(
        "/deliberation/cedar-river-drought-surcharge?version=2#proposal-versions",
        "deliberation",
      ),
    ).toBe(
      "/deliberation/cedar-river-drought-surcharge?version=2&demoStep=deliberation#proposal-versions",
    );
  });

  it("continues to the next stage URL when the next step has a href", () => {
    expect(getNextDemoStepId("idea-commons")).toBe("proposal");
    expect(getDemoContinueHref("idea-commons")).toBe(
      "/idea-commons/idea-cedar-surcharge-discussion?demoStep=proposal",
    );
    expect(demoReturnHref("idea-commons")).toBe("/demo?step=idea-commons");
    expect(getNextDemoStepId("policy")).toBe("actions");
    expect(getDemoContinueHref("policy")).toBe(
      "/actions/cedar-river-drought-surcharge?demoStep=actions",
    );
    expect(getNextDemoStepId("audit")).toBe("trajectories");
    expect(getDemoContinueHref("audit")).toBe(
      "/formal-topics?demoStep=trajectories",
    );
    expect(getDemoContinueHref("questions-board")).toBe("/demo?step=close");
  });
});
