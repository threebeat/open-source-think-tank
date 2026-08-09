import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DeliberationObserver } from "@/features/deliberation/DeliberationObserver";
import { ProposalVersionNavigator } from "@/features/deliberation/ProposalVersionNavigator";
import { getDeliberationBundle } from "@/domain/selectors";
import { fixtureCatalog } from "@/fixtures";
import { amendmentStatusLabels } from "@/lib/evidence-labels";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(() => {
  cleanup();
});

describe("deliberation observer", () => {
  const bundle = getDeliberationBundle(
    fixtureCatalog,
    "cedar-river-drought-surcharge",
  );

  it("supports click and arrow-key proposal version navigation", async () => {
    const user = userEvent.setup();
    if (!bundle) {
      throw new Error("Expected deliberation bundle");
    }

    render(<ProposalVersionNavigator proposals={bundle.proposals} />);

    const version3 = screen.getByRole("tab", { name: "Version 3" });
    expect(version3).toHaveAttribute("aria-selected", "true");
    expect(version3).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("tab", { name: "Version 1" })).toHaveAttribute(
      "tabindex",
      "-1",
    );
    expect(
      screen.getByText(/hardship rebate and sunset review/i),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Version 1" }));
    const version1 = screen.getByRole("tab", { name: "Version 1" });
    expect(version1).toHaveAttribute("aria-selected", "true");
    expect(version1).toHaveAttribute("tabindex", "0");
    const panel = screen.getByRole("tabpanel");
    expect(
      within(panel).getByText(/essential indoor allotment/i),
    ).toBeInTheDocument();

    version1.focus();
    await user.keyboard("{ArrowRight}");
    const version2 = screen.getByRole("tab", { name: "Version 2" });
    expect(version2).toHaveAttribute("aria-selected", "true");
    expect(version2).toHaveFocus();
    expect(version2).toHaveAttribute("tabindex", "0");
    expect(version1).toHaveAttribute("tabindex", "-1");

    await user.keyboard("{End}");
    expect(screen.getByRole("tab", { name: "Version 3" })).toHaveFocus();
    await user.keyboard("{Home}");
    expect(screen.getByRole("tab", { name: "Version 1" })).toHaveFocus();
  });

  it("shows targeted amendment and billing evidence links", () => {
    if (!bundle?.agendaItem) {
      throw new Error("Expected deliberation bundle with agenda item");
    }

    render(
      <DeliberationObserver
        deliberation={bundle.deliberation}
        topic={bundle.topic}
        participants={bundle.participants}
        conflicts={bundle.conflicts}
        proposals={bundle.proposals}
        amendments={bundle.amendments}
        relatedEvidence={bundle.relatedEvidence}
        claimsById={bundle.claimsById}
        statementsById={bundle.statementsById}
        evidenceById={bundle.evidenceById}
        agendaSlug={bundle.agendaItem.slug}
      />,
    );

    expect(screen.getAllByText(amendmentStatusLabels.accepted).length).toBe(2);
    expect(
      screen.getByRole("link", {
        name: /Evidence \(limited\): Household bill impact vignettes/i,
      }),
    ).toHaveAttribute(
      "href",
      "/topics/cedar-river-drought-surcharge#evidence-equity-impact-memo",
    );
    expect(
      screen.getByRole("link", {
        name: /Consultation statement: .*sunset/i,
      }),
    ).toHaveAttribute(
      "href",
      "/topics/cedar-river-drought-surcharge/consult#stmt-sunset-clause",
    );
    expect(
      screen.getByRole("link", {
        name: /Evidence \(pending\): Billing system change estimate/i,
      }),
    ).toHaveAttribute(
      "href",
      "/topics/cedar-river-drought-surcharge#evidence-billing-ops-brief",
    );
    expect(
      screen.queryByRole("link", {
        name: /Evidence \(accepted\): Cedar Basin storage/i,
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/would lapse unless renewed by the legally authorized body/i),
    ).toBeInTheDocument();
  });
});
