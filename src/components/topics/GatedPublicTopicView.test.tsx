import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { GatedPublicTopicView } from "@/components/topics/GatedPublicTopicView";
import type { PublicTopicProjection } from "@/lib/topics/public-projection";

const PRIVATE_SENTINEL = "SENTINEL_PRIVATE_DETAIL_NEVER_IN_HTML";

function sampleProjection(
  overrides: Partial<PublicTopicProjection> = {},
): PublicTopicProjection {
  return {
    slug: "alpha-topic",
    title: "Alpha topic with a particularly long title that must wrap cleanly",
    question: "What should the alpha publication demonstrate?",
    background: "Background for the alpha publication.",
    scope: "Scope for the alpha publication.",
    geography: {
      jurisdictionLevel: "statewide",
      stateCode: "TN",
      countyFips: null,
    },
    operationalLabel: "Paused (operational)",
    publishedAt: "2026-08-11T17:00:00.000Z",
    claims: [
      {
        title: "Accepted claim",
        summary: "Claim summary",
        approachLabel: "Transparency",
        workflowPublicRationale: "Accepted after review.",
        conflictPublicSummary: "Claim conflict public summary.",
        revisionSummary: {
          revisionCount: 1,
          latestRevisionAt: "2026-08-10T12:00:00.000Z",
          changedFieldLabels: ["Summary"],
        },
        latestRestorationNotice: {
          subjectKind: "claim",
          action: "restore",
          publicRationale: "Restored after clarification.",
          recordedAt: "2026-08-11T18:00:00.000Z",
        },
        evidenceLinks: [
          { relationship: "supporting", evidenceKey: "ev-1" },
          { relationship: "counterevidence", evidenceKey: "ev-2" },
        ],
      },
    ],
    evidence: [
      {
        key: "ev-1",
        sourceUrl:
          "https://example.ostt.synth.test/very-long-source-path/that-should-wrap-without-horizontal-overflow/memo",
        title: "Supporting memo",
        organization: "Cedar Desk",
        authorType: "agency",
        sourceType: "memo",
        limitations: "Synthetic limitations only.",
        qualityStatus: "limited",
        qualityPublicRationale: "Useful with constraints.",
        workflowPublicRationale: "Workflow accepted.",
        conflictPublicSummary: "Evidence conflict public summary.",
        revisionSummary: null,
        latestRestorationNotice: null,
      },
      {
        key: "ev-2",
        sourceUrl: "https://example.ostt.synth.test/counter",
        title: "Counter brief",
        organization: "Alternate Desk",
        authorType: "researcher",
        sourceType: "report",
        limitations: "Counter limitations.",
        qualityStatus: "accepted",
        qualityPublicRationale: "Transparent methods.",
        workflowPublicRationale: "Accepted as counterevidence.",
        conflictPublicSummary: null,
        revisionSummary: null,
        latestRestorationNotice: null,
      },
    ],
    withheldModerationNotices: [
      {
        subjectKind: "evidence",
        action: "hold",
        publicRationale: "Temporarily withheld for citation checks.",
        recordedAt: "2026-08-11T16:00:00.000Z",
      },
    ],
    ...overrides,
  };
}

describe("GatedPublicTopicView", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders equal supporting/counterevidence structure and evidence conflict summary", () => {
    const { container } = render(
      <GatedPublicTopicView projection={sampleProjection()} />,
    );

    expect(
      screen.getByRole("heading", { name: "How to read this publication" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Supporting evidence" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Counterevidence" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Evidence conflict disclosure" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Evidence conflict public summary."),
    ).toBeInTheDocument();
    expect(
      screen.getByText((content) =>
        content.includes("not approval, truth certification, or consensus"),
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Withheld from this publication/i }),
    ).toBeInTheDocument();

    const times = container.querySelectorAll("time[datetime]");
    expect(times.length).toBeGreaterThanOrEqual(2);
    expect(container.innerHTML).not.toContain(PRIVATE_SENTINEL);
    expect(container.innerHTML).not.toContain("privateDetail");

    const ids = [...container.querySelectorAll("[id]")].map((el) => el.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(
      container.querySelector("#claim-0-conflict"),
    ).not.toBeNull();
    expect(
      container.querySelector("#claim-0-support-0-evidence-conflict"),
    ).not.toBeNull();
  });

  it("renders a safe empty published shell without inventing excluded content", () => {
    const { container } = render(
      <GatedPublicTopicView
        projection={sampleProjection({
          claims: [],
          evidence: [],
          withheldModerationNotices: [],
        })}
      />,
    );

    expect(
      screen.getByText(/No currently included claims or evidence/i),
    ).toBeInTheDocument();
    expect(
      within(container).queryByRole("heading", { name: "Accepted claim" }),
    ).not.toBeInTheDocument();
    expect(
      within(container).queryByText("Supporting memo"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Back to topics/i }),
    ).toBeInTheDocument();
  });

  it("keeps long URLs breakable and comparison available when both sides exist", () => {
    const { container } = render(
      <GatedPublicTopicView projection={sampleProjection()} />,
    );
    const url = screen.getAllByRole("link", {
      name: /very-long-source-path/i,
    })[0]!;
    expect(url.className).toMatch(/break-all/);
    expect(
      screen.getByRole("heading", { name: "Compare two sources" }),
    ).toBeInTheDocument();
    // Comparison should not repeat the full source URL block.
    const compare = screen
      .getByRole("heading", { name: "Compare two sources" })
      .closest("section");
    expect(compare).toBeTruthy();
    expect(
      within(compare!).queryByRole("link", { name: /very-long-source-path/i }),
    ).toBeNull();
    expect(container.querySelector(".break-words")).toBeTruthy();
  });
});
