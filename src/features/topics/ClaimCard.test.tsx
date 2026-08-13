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
  it("shows compact evidence references without duplicating full source details", () => {
    render(
      <ClaimCard
        claim={claim}
        supporting={[pending]}
        counterevidence={[disputed]}
      />,
    );

    expect(screen.getByText("Approach 1")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Supporting evidence/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Counterevidence/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Review: Pending/i)).toBeInTheDocument();
    expect(screen.getByText(/Review: Disputed/i)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Compare two sources" }),
    ).toBeInTheDocument();
    // Full limitations / review explanations stay in the inventory disclosure.
    expect(screen.queryByText(/Not yet reviewed/i)).not.toBeInTheDocument();
    expect(
      screen.getByText(/Full source details, limitations, and conflict disclosures/i),
    ).toBeInTheDocument();
  });
});
