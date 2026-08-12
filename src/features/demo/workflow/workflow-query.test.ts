import { describe, expect, it } from "vitest";

import {
  DEFAULT_WORKFLOW_DEMO_QUERY,
  DEFAULT_WORKFLOW_PREVIEW_QUERY,
  parseWorkflowDemoQuery,
  parseWorkflowPreviewQuery,
  serializeWorkflowDemoQuery,
  serializeWorkflowPreviewQuery,
  workflowDemoHref,
  workflowPreviewHref,
} from "@/features/demo/workflow/workflow-query";

describe("workflow-query", () => {
  it("defaults unknown or missing view/state", () => {
    expect(parseWorkflowPreviewQuery(new URLSearchParams())).toEqual(
      DEFAULT_WORKFLOW_PREVIEW_QUERY,
    );
    expect(
      parseWorkflowPreviewQuery(new URLSearchParams("view=admin&state=deleted")),
    ).toEqual(DEFAULT_WORKFLOW_PREVIEW_QUERY);
  });

  it("parses deep-link view and moderation state", () => {
    expect(
      parseWorkflowPreviewQuery(
        new URLSearchParams("view=moderation&state=held"),
      ),
    ).toEqual({ view: "moderation", state: "held" });
    expect(
      parseWorkflowPreviewQuery(new URLSearchParams("view=visitor")),
    ).toEqual({ view: "visitor", state: "visible" });
  });

  it("serializes non-default view/state for refresh-stable URLs", () => {
    expect(
      serializeWorkflowPreviewQuery({
        view: "participant",
        state: "visible",
      }).toString(),
    ).toBe("");
    expect(
      serializeWorkflowPreviewQuery({
        view: "moderation",
        state: "held",
      }).toString(),
    ).toBe("view=moderation&state=held");
    expect(
      serializeWorkflowPreviewQuery({
        view: "revision",
        state: "held",
      }).toString(),
    ).toBe("view=revision");
  });

  it("maps legacy view deep links to the secondary explorer task", () => {
    expect(
      parseWorkflowDemoQuery(
        new URLSearchParams("view=moderation&state=held"),
      ),
    ).toEqual({
      task: "explore",
      step: null,
      explorer: { view: "moderation", state: "held" },
    });
  });

  it("parses practice task and step deep links", () => {
    expect(
      parseWorkflowDemoQuery(
        new URLSearchParams("task=topic-recommendation&step=review"),
      ),
    ).toEqual({
      task: "topic-recommendation",
      step: "review",
      explorer: null,
    });
    expect(
      parseWorkflowDemoQuery(
        new URLSearchParams("task=source-contribution&step=url"),
      ),
    ).toEqual({
      task: "source-contribution",
      step: "url",
      explorer: null,
    });
    expect(parseWorkflowDemoQuery(new URLSearchParams())).toEqual(
      DEFAULT_WORKFLOW_DEMO_QUERY,
    );
  });

  it("builds demo workflow hrefs with safe fixture/step params only", () => {
    expect(workflowDemoHref(DEFAULT_WORKFLOW_DEMO_QUERY)).toBe("/demo/workflow");
    expect(
      workflowDemoHref({
        task: "topic-recommendation",
        step: "review",
        explorer: null,
      }),
    ).toBe("/demo/workflow?task=topic-recommendation&step=review");
    expect(
      workflowPreviewHref({ view: "visitor", state: "restored" }),
    ).toBe("/demo/workflow?task=explore&view=visitor&state=restored");
    expect(
      serializeWorkflowDemoQuery({
        task: "explore",
        step: null,
        explorer: { view: "moderation", state: "held" },
      }).toString(),
    ).toBe("task=explore&view=moderation&state=held");
  });
});
