import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { EvidenceDisclosure } from "@/features/topics/EvidenceDisclosure";
import type { EvidenceDisclosureItem } from "@/features/topics/evidence-disclosure-model";

const item: EvidenceDisclosureItem = {
  id: "ev-demo",
  title: "Demo source",
  relationship: "supporting",
  relationshipLabel: "Supporting",
  qualityLabel: "Review: Accepted",
  sourceOrganizationOrType: "Cedar Desk",
  contributionSentence: "Contributes a public-safe summary.",
  sourceUrl: "https://example.ostt.synth.test/report",
  sourceLinkTitle: "Open source at example.ostt.synth.test",
  sourceHostname: "example.ostt.synth.test",
  sourceUnavailableLabel: null,
  publishedOn: "2026-01-01",
  authorTypeLabel: "Agency",
  sourceTypeLabel: "Report",
  qualityRationale: "Transparent methods.",
  workflowRationale: "Accepted after review.",
  limitations: "Synthetic only.",
  conflictSummary: "Sponsor disclosed.",
  revisionSummaryLabel: "1 revision(s)",
  moderationNoticeLabel: null,
  extendedExplanation: "Extra context.",
  linkedClaimLabels: ["Claim A"],
};

describe("EvidenceDisclosure", () => {
  afterEach(() => {
    cleanup();
  });

  it("defaults to collapsed and expands to reveal source link and metadata", async () => {
    const user = userEvent.setup();
    render(<EvidenceDisclosure item={item} />);

    const details = screen.getByTestId("evidence-disclosure-details");
    expect(details).not.toHaveAttribute("open");
    expect(screen.getByText("Demo source")).toBeInTheDocument();
    expect(screen.getByText("Supporting")).toBeInTheDocument();
    expect(screen.getByText("Review: Accepted")).toBeInTheDocument();
    expect(screen.getByText("Cedar Desk")).toBeInTheDocument();
    expect(
      screen.getByText("Contributes a public-safe summary."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("View evidence details and source"),
    ).toBeInTheDocument();

    await user.click(screen.getByText("View evidence details and source"));
    expect(details).toHaveAttribute("open");
    const link = screen.getByTestId("evidence-source-link");
    expect(link).toHaveAttribute(
      "href",
      "https://example.ostt.synth.test/report",
    );
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link).toHaveAttribute("referrerPolicy", "no-referrer");
    expect(screen.getByText("Transparent methods.")).toBeInTheDocument();
    expect(screen.getByText("Claim A")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Evidence conflict disclosure" }),
    ).toBeInTheDocument();
  });

  it("exposes a focusable summary control (keyboard toggle covered in Playwright)", async () => {
    const user = userEvent.setup();
    render(<EvidenceDisclosure item={item} />);
    const summary = screen
      .getByText("View evidence details and source")
      .closest("summary");
    expect(summary).toBeTruthy();
    await user.tab();
    expect(summary).toHaveFocus();
    // jsdom does not fully implement native <details> keyboard toggling;
    // click path proves the control is activatable without nested interactive children.
    await user.click(summary!);
    expect(screen.getByTestId("evidence-disclosure-details")).toHaveAttribute(
      "open",
    );
    expect(summary!.querySelector("a, button, input")).toBeNull();
  });
});
