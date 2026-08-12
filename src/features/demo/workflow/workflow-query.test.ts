import { describe, expect, it } from "vitest";

import {
  DEFAULT_WORKFLOW_PREVIEW_QUERY,
  parseWorkflowPreviewQuery,
  serializeWorkflowPreviewQuery,
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

  it("builds demo workflow hrefs", () => {
    expect(workflowPreviewHref(DEFAULT_WORKFLOW_PREVIEW_QUERY)).toBe(
      "/demo/workflow",
    );
    expect(
      workflowPreviewHref({ view: "visitor", state: "restored" }),
    ).toBe("/demo/workflow?view=visitor&state=restored");
  });
});
