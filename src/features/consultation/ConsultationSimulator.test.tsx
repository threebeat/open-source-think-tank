import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ConsultationSimulator } from "@/features/consultation/ConsultationSimulator";
import { storageKeyForTopic } from "@/features/consultation/consultation-storage";
import { getScenarioBundle } from "@/domain/selectors";
import { fixtureCatalog } from "@/fixtures";

describe("ConsultationSimulator", () => {
  const bundle = getScenarioBundle(
    fixtureCatalog,
    "cedar-river-drought-surcharge",
  );

  beforeEach(() => {
    window.sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
    window.sessionStorage.clear();
  });

  it("supports keyboard-operated Agree/Disagree/Pass and keeps votes local", async () => {
    const user = userEvent.setup();
    if (!bundle?.consultationResult) {
      throw new Error("Expected Cedar River consultation fixture");
    }

    render(
      <ConsultationSimulator
        topicId={bundle.topic.id}
        topicSlug={bundle.topic.slug}
        topicTitle={bundle.topic.title}
        statements={bundle.consultationStatements}
        result={bundle.consultationResult}
        groups={fixtureCatalog.opinionGroups}
        claims={bundle.claims}
        evidenceSources={bundle.evidenceSources}
      />,
    );

    expect(
      screen.getByText(/not a live Pol\.is conversation/i),
    ).toBeInTheDocument();

    const agree = screen.getByRole("button", { name: "Agree" });
    agree.focus();
    expect(agree).toHaveFocus();
    await user.keyboard("{Enter}");

    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "1",
    );
    expect(
      window.sessionStorage.getItem(storageKeyForTopic(bundle.topic.id)),
    ).toContain("agree");

    await user.click(screen.getByRole("button", { name: "Disagree" }));
    await user.click(screen.getByRole("button", { name: "Pass" }));

    const openReport = screen.getByRole("button", {
      name: "Open synthetic report",
    });
    expect(openReport).toBeEnabled();
    await user.click(openReport);

    const report = screen.getByRole("region", {
      name: "Fixed synthetic consultation report",
    });
    expect(
      within(report).getByText("Not a representative sample"),
    ).toBeInTheDocument();
    expect(within(report).getByText("Consensus is not proof")).toBeInTheDocument();
    expect(within(report).getByText("Group A, Group B, Group C")).toBeInTheDocument();
    expect(
      within(report).getByText(/Neutral labels only/i),
    ).toBeInTheDocument();
  });

  it("resets local responses without altering fixture report content", async () => {
    const user = userEvent.setup();
    if (!bundle?.consultationResult) {
      throw new Error("Expected Cedar River consultation fixture");
    }

    render(
      <ConsultationSimulator
        topicId={bundle.topic.id}
        topicSlug={bundle.topic.slug}
        topicTitle={bundle.topic.title}
        statements={bundle.consultationStatements}
        result={bundle.consultationResult}
        groups={fixtureCatalog.opinionGroups}
        claims={bundle.claims}
        evidenceSources={bundle.evidenceSources}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Agree" }));
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "1",
    );

    await user.click(screen.getByRole("button", { name: "Reset local responses" }));

    expect(
      window.sessionStorage.getItem(storageKeyForTopic(bundle.topic.id)),
    ).toBeNull();
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "0",
    );
  });
});
