import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DecisionRecord } from "@/features/decisions/DecisionRecord";
import { getDecisionBundle } from "@/domain/selectors";
import { fixtureCatalog } from "@/fixtures";

describe("DecisionRecord", () => {
  it("shows recommendation outcome, roll call, minority report, and backward links", () => {
    const bundle = getDecisionBundle(
      fixtureCatalog,
      "cedar-river-drought-surcharge",
    );
    if (!bundle) {
      throw new Error("Expected decision bundle");
    }

    render(
      <DecisionRecord
        decision={bundle.decision}
        topic={bundle.topic}
        deliberation={bundle.deliberation}
        agendaItem={bundle.agendaItem}
        finalProposal={bundle.finalProposal}
        proposalHistory={bundle.proposalHistory}
        rollCall={bundle.rollCall}
        minorityAuthors={bundle.minorityAuthors}
        conflicts={bundle.conflicts}
      />,
    );

    expect(screen.getAllByText("Recommended").length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getByText(/no adoption date claimed/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Policy Council roll call" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Ada Nguyen")).toBeInTheDocument();
    expect(screen.getByText("Farah Quinn")).toBeInTheDocument();
    expect(screen.getByText("Hugo Ren")).toBeInTheDocument();
    expect(screen.getByText("Stepped aside (conflict)")).toBeInTheDocument();
    expect(
      screen.getByText(/grounds the recorded step-aside because of a conflict/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/research stipend from a fictional water-efficiency nonprofit/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /Minority report — prefer voluntary-first extension/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Authored by Farah Quinn/i)).toBeInTheDocument();
    expect(screen.getByText("Version 1")).toBeInTheDocument();
    expect(screen.getByText("Version 3")).toBeInTheDocument();
    expect(
      screen.getByText(/Draft v1 proposes Stage 1–3 surcharges/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", {
        name: "Open version 1 in policy drafting navigator",
      }),
    ).toHaveAttribute(
      "href",
      "/deliberation/cedar-river-drought-surcharge?version=1#proposal-versions",
    );
    expect(
      screen.getByRole("link", { name: "Fact-Check & Research" }),
    ).toHaveAttribute("href", "/topics/cedar-river-drought-surcharge");
    expect(
      screen.getByRole("link", { name: "Public Input" }),
    ).toHaveAttribute("href", "/topics/cedar-river-drought-surcharge/consult");
    expect(
      screen.getByRole("link", { name: "Agenda review" }),
    ).toHaveAttribute("href", "/agenda/cedar-river-drought-surcharge");
    expect(
      screen.getByRole("link", { name: "State-Level Policy Drafting" }),
    ).toHaveAttribute("href", "/deliberation/cedar-river-drought-surcharge");
  });
});
