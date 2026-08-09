import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { ProposalVersionNavigator } from "@/features/deliberation/ProposalVersionNavigator";
import { getDeliberationBundle } from "@/domain/selectors";
import { fixtureCatalog } from "@/fixtures";
import { amendmentStatusLabels } from "@/lib/evidence-labels";
import { DeliberationObserver } from "@/features/deliberation/DeliberationObserver";

describe("deliberation observer", () => {
  const bundle = getDeliberationBundle(
    fixtureCatalog,
    "cedar-river-drought-surcharge",
  );

  it("navigates proposal versions", async () => {
    const user = userEvent.setup();
    if (!bundle) {
      throw new Error("Expected deliberation bundle");
    }

    render(<ProposalVersionNavigator proposals={bundle.proposals} />);

    expect(
      screen.getByRole("tab", { name: "Version 3" }),
    ).toHaveAttribute("aria-selected", "true");
    expect(
      screen.getByText(/hardship rebate and sunset review/i),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Version 1" }));
    expect(
      screen.getByRole("tab", { name: "Version 1" }),
    ).toHaveAttribute("aria-selected", "true");
    const panel = screen.getByRole("tabpanel");
    expect(
      within(panel).getByText(/essential indoor allotment/i),
    ).toBeInTheDocument();
    expect(within(panel).getByText("Draft")).toBeInTheDocument();
  });

  it("shows amendment statuses, recusal, and redaction reason", () => {
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
        agendaSlug={bundle.agendaItem.slug}
      />,
    );

    expect(screen.getAllByText(amendmentStatusLabels.accepted).length).toBe(
      2,
    );
    expect(
      screen.getByText(/Recused from the final vote/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Personal contact details are omitted/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/capacity-limited participation, not secret/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", {
        name: /Evidence \(pending\):/i,
      }),
    ).toHaveAttribute(
      "href",
      "/topics/cedar-river-drought-surcharge#evidence-billing-ops-brief",
    );
  });
});
