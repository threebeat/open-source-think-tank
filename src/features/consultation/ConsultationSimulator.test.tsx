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

  it("supports keyboard Agree, Disagree, and Pass and announces statement changes", async () => {
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

    const liveRegion = screen.getByRole("status", {
      name: "Public input practice updates",
    });
    const voteGroup = screen.getByRole("group", {
      name: "Respond to this statement",
    });

    const agree = within(voteGroup).getByRole("button", { name: "Agree" });
    agree.focus();
    expect(agree).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(liveRegion).toHaveTextContent(/Recorded agree/i);
    expect(liveRegion).toHaveTextContent(/Now viewing statement 2/i);
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "1",
    );

    const disagree = within(voteGroup).getByRole("button", {
      name: "Disagree",
    });
    disagree.focus();
    expect(disagree).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(liveRegion).toHaveTextContent(/Recorded disagree/i);
    expect(liveRegion).toHaveTextContent(/Now viewing statement 3/i);

    const pass = within(voteGroup).getByRole("button", { name: "Pass" });
    pass.focus();
    expect(pass).toHaveFocus();
    await user.keyboard(" ");
    expect(liveRegion).toHaveTextContent(/Recorded pass/i);
    expect(liveRegion).toHaveTextContent(/Now viewing statement 4/i);

    expect(
      window.sessionStorage.getItem(storageKeyForTopic(bundle.topic.id)),
    ).toMatch(/agree|disagree|pass/);

    const openReport = screen.getByRole("button", {
      name: "Open synthetic report",
    });
    expect(openReport).toBeEnabled();
    await user.click(openReport);

    const report = screen.getByRole("region", {
      name: "Sample Public Input Report",
    });
    expect(
      within(report).getByText("Not a representative sample"),
    ).toBeInTheDocument();
    expect(within(report).getByText("Consensus is not proof")).toBeInTheDocument();
    expect(within(report).getByText("Group A, Group B, Group C")).toBeInTheDocument();
    const allStatements = within(report).getByRole("heading", {
      name: "All statements and evidence links",
    }).parentElement;
    if (!allStatements) {
      throw new Error("Expected all-statements section");
    }
    expect(
      within(allStatements).getByText(
        /Popular in the synthetic report, but linked evidence is weak or rejected/i,
      ),
    ).toBeInTheDocument();
    expect(
      within(allStatements).getByText(
        /Less popular in the synthetic report, but linked evidence is stronger/i,
      ),
    ).toBeInTheDocument();
    const rejectedEvidence = within(allStatements).getByRole("link", {
      name: /Evidence \(rejected\):/i,
    });
    expect(rejectedEvidence.getAttribute("href")).toMatch(
      /\/topics\/cedar-river-drought-surcharge#evidence-/,
    );
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
    expect(
      screen.getByRole("status", { name: "Public input practice updates" }),
    ).toHaveTextContent(/Local responses cleared/i);
  });
});
