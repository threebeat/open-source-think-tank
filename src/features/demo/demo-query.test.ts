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
    expect(getNextDemoStepId("topics")).toBe("consultation");
    expect(getDemoContinueHref("topics")).toBe(
      "/topics/cedar-river-drought-surcharge/consult?demoStep=consultation",
    );
    expect(demoReturnHref("topics")).toBe("/demo?step=topics");
    expect(getNextDemoStepId("decision")).toBe("workflow");
    expect(getDemoContinueHref("decision")).toBe(
      "/demo/workflow?demoStep=workflow",
    );
    expect(getNextDemoStepId("workflow")).toBe("transparency");
    expect(getDemoContinueHref("transparency")).toBe(
      "/demo?step=questions-legal",
    );
  });
});

