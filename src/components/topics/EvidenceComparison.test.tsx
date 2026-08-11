import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import {
  EvidenceComparison,
  type ComparableEvidenceItem,
} from "@/components/topics/EvidenceComparison";

const items: ComparableEvidenceItem[] = [
  {
    key: "a",
    relationship: "supporting",
    title: "Support memo",
    organization: "Agency A",
    authorType: "agency",
    sourceType: "memo",
    limitations: "Synthetic support limitations for comparison.",
    qualityStatus: "limited",
    qualityPlainLanguage: "Limited quality means constraints apply.",
    qualityPublicRationale: null,
    workflowPublicRationale: null,
    sourceUrl: "https://example.ostt.synth.test/support",
  },
  {
    key: "b",
    relationship: "counterevidence",
    title: "Counter report",
    organization: "Desk B",
    authorType: "researcher",
    sourceType: "report",
    limitations: "Synthetic counter limitations for comparison.",
    qualityStatus: "accepted",
    qualityPlainLanguage: "Accepted quality does not prove truth.",
    qualityPublicRationale: null,
    workflowPublicRationale: null,
    sourceUrl: "https://example.ostt.synth.test/counter",
  },
];

describe("EvidenceComparison", () => {
  it("requires exactly two selections and announces status", async () => {
    const user = userEvent.setup();
    render(<EvidenceComparison claimTitle="Demo claim" items={items} />);

    expect(
      screen.getByRole("heading", { name: "Compare two sources" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/No sources selected/i);

    await user.click(screen.getByLabelText(/Support memo/i));
    expect(screen.getByRole("status")).toHaveTextContent(/One source selected/i);

    await user.click(screen.getByLabelText(/Counter report/i));
    expect(screen.getByRole("status")).toHaveTextContent(/Comparing/i);
    expect(screen.getAllByText("Relationship").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Evidence quality").length).toBeGreaterThan(0);

    await user.click(
      screen.getByRole("button", { name: /Clear comparison selection/i }),
    );
    expect(screen.getByRole("status")).toHaveTextContent(/No sources selected/i);
  });

  it("omits comparison when fewer than two sources", () => {
    const { container } = render(
      <EvidenceComparison claimTitle="Solo" items={[items[0]!]} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
