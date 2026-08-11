import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ClaimCard } from "@/features/topics/ClaimCard";
import type { Claim, EvidenceSource } from "@/domain/types";

const claim: Claim = {
  id: "claim-test",
  synthetic: true,
  topicId: "topic-test",
  title: "Test claim A",
  summary: "Summary A",
  approachLabel: "Approach 1",
  supportingEvidenceIds: ["evidence-pending"],
  counterEvidenceIds: ["evidence-disputed"],
};

const pending: EvidenceSource = {
  id: "evidence-pending",
  synthetic: true,
  topicId: "topic-test",
  title: "Pending source",
  organization: "Fictional Desk",
  authorType: "agency",
  sourceType: "memo",
  publishedOn: "2026-01-01",
  reviewStatus: "pending",
  conflicts: "None disclosed.",
  limitations: "Not yet reviewed.",
  summary: "Awaiting review.",
};

const disputed: EvidenceSource = {
  id: "evidence-disputed",
  synthetic: true,
  topicId: "topic-test",
  title: "Disputed source",
  organization: "Fictional Outlet",
  authorType: "journalist",
  sourceType: "news",
  publishedOn: "2026-01-02",
  reviewStatus: "disputed",
  conflicts: "Sponsored content.",
  limitations: "Qualitative only.",
  summary: "Contested interpretation.",
};

describe("ClaimCard", () => {
  it("gives opposing evidence the same card treatment and explains review states", () => {
    render(
      <ClaimCard
        claim={claim}
        supporting={[pending]}
        counterevidence={[disputed]}
      />,
    );

    expect(screen.getByText("Approach 1")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Supporting evidence" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Evidence Against This Claim" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Review: Pending")).toBeInTheDocument();
    expect(screen.getByText("Review: Disputed")).toBeInTheDocument();
    expect(screen.getAllByText("Supporting").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Evidence Against This Claim").length).toBeGreaterThan(0);
    expect(
      screen.getByText(/Submitted for research review; not yet relied on/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Material objections remain/i),
    ).toBeInTheDocument();
  });
});
