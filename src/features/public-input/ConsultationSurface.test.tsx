import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ConsultationSurface } from "@/features/public-input/ConsultationSurface";
import type { PublicConsultationView } from "@/lib/public-input/lifecycle/types";

function view(
  overrides: Partial<PublicConsultationView> = {},
): PublicConsultationView {
  return {
    topicId: "topic-1",
    workflowState: "open",
    providerAvailability: "not_configured",
    publicTitle: "Cedar River consultation",
    publicPrompt: "Share short statements on the surcharge.",
    opensAt: "2026-08-01T12:00:00.000Z",
    closesAt: null,
    configurationVersion: 1,
    ...overrides,
  };
}

describe("ConsultationSurface", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders not-configured state without any iframe", () => {
    const { container } = render(
      <ConsultationSurface
        topicSlug="cedar-river"
        topicTitle="Cedar River"
        consultation={null}
        lane="gated"
      />,
    );
    expect(screen.getByTestId("consultation-surface")).toHaveAttribute(
      "data-workflow-state",
      "not_configured",
    );
    expect(screen.getByText(/Consultation not configured/i)).toBeInTheDocument();
    expect(container.querySelector("iframe")).toBeNull();
  });

  it("renders open institutional state with fail-closed embed shell", () => {
    const { container } = render(
      <ConsultationSurface
        topicSlug="cedar-river"
        topicTitle="Cedar River"
        consultation={view()}
        lane="gated"
      />,
    );
    expect(screen.getByText(/Open for comments and votes/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Open institutionally — live provider blocked/i),
    ).toBeInTheDocument();
    expect(container.querySelector("iframe")).toBeNull();
    expect(container.querySelector("script")).toBeNull();
  });

  it("keeps provider availability independent copy for degraded outage", () => {
    render(
      <ConsultationSurface
        topicSlug="cedar-river"
        topicTitle="Cedar River"
        consultation={view({
          workflowState: "open",
          providerAvailability: "degraded",
        })}
        lane="gated"
        operationalNote="Sanitized outage signal"
      />,
    );
    expect(
      screen.getAllByText(/Provider degraded/i).length,
    ).toBeGreaterThanOrEqual(2);
    expect(
      screen.getByText(/Institutional workflow state is unchanged/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Sanitized outage signal/i)).toBeInTheDocument();
  });

  it("public-demo never claims a live embed path", () => {
    render(
      <ConsultationSurface
        topicSlug="cedar-river"
        topicTitle="Cedar River"
        consultation={null}
        lane="public-demo"
      />,
    );
    expect(
      screen.getByText(/Public-demo uses fixtures only/i),
    ).toBeInTheDocument();
  });

  const states: Array<PublicConsultationView["workflowState"]> = [
    "ready",
    "commenting_closed",
    "voting_closed",
    "closed",
    "archived",
  ];

  it.each(states)("renders distinct copy for workflow state %s", (workflowState) => {
    render(
      <ConsultationSurface
        topicSlug="cedar-river"
        topicTitle="Cedar River"
        consultation={view({ workflowState })}
        lane="gated"
      />,
    );
    expect(screen.getByTestId("consultation-surface")).toHaveAttribute(
      "data-workflow-state",
      workflowState,
    );
    expect(screen.getByTestId("embed-boundary-placeholder")).toBeInTheDocument();
  });
});
