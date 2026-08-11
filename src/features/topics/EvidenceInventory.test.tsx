import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { EvidenceInventory } from "@/features/topics/EvidenceInventory";
import {
  applyEvidenceInventory,
  DEFAULT_EVIDENCE_INVENTORY,
  EVIDENCE_REVIEW_SORT_ORDER,
} from "@/features/topics/evidence-inventory";
import { getScenarioBundle } from "@/domain/selectors";
import { fixtureCatalog } from "@/fixtures";

afterEach(() => {
  cleanup();
});

describe("evidence inventory helpers", () => {
  const bundle = getScenarioBundle(
    fixtureCatalog,
    "cedar-river-drought-surcharge",
  );

  it("defaults to original fixture order and sorts review status deterministically", () => {
    if (!bundle) {
      throw new Error("Expected Cedar River bundle");
    }
    const original = applyEvidenceInventory(
      bundle.evidenceSources,
      DEFAULT_EVIDENCE_INVENTORY,
      bundle.claims,
    );
    expect(original.map((source) => source.id)).toEqual(
      bundle.evidenceSources.map((source) => source.id),
    );

    const byReview = applyEvidenceInventory(
      bundle.evidenceSources,
      { ...DEFAULT_EVIDENCE_INVENTORY, sort: "review" },
      bundle.claims,
    );
    const ranks = byReview.map((source) =>
      EVIDENCE_REVIEW_SORT_ORDER.indexOf(source.reviewStatus),
    );
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  });

  it("filters by relationship and restores original order on reset state", () => {
    if (!bundle) {
      throw new Error("Expected Cedar River bundle");
    }
    const supporting = applyEvidenceInventory(
      bundle.evidenceSources,
      { ...DEFAULT_EVIDENCE_INVENTORY, relationship: "supporting" },
      bundle.claims,
    );
    expect(supporting.length).toBeGreaterThan(0);
    expect(
      supporting.every((source) =>
        bundle.claims.some((claim) =>
          claim.supportingEvidenceIds.includes(source.id),
        ),
      ),
    ).toBe(true);

    const counter = applyEvidenceInventory(
      bundle.evidenceSources,
      { ...DEFAULT_EVIDENCE_INVENTORY, relationship: "counterevidence" },
      bundle.claims,
    );
    expect(counter.length).toBeGreaterThan(0);
    expect(
      counter.every((source) =>
        bundle.claims.some((claim) =>
          claim.counterEvidenceIds.includes(source.id),
        ),
      ),
    ).toBe(true);

    const combined = applyEvidenceInventory(
      bundle.evidenceSources,
      {
        reviewStatus: "accepted",
        sourceType: "memo",
        authorType: "agency",
        relationship: "supporting",
        sort: "title",
      },
      bundle.claims,
    );
    expect(
      combined.every(
        (source) =>
          source.reviewStatus === "accepted" &&
          source.sourceType === "memo" &&
          source.authorType === "agency",
      ),
    ).toBe(true);

    const reset = applyEvidenceInventory(
      bundle.evidenceSources,
      DEFAULT_EVIDENCE_INVENTORY,
      bundle.claims,
    );
    expect(reset.map((source) => source.id)).toEqual(
      bundle.evidenceSources.map((source) => source.id),
    );
  });
});

describe("EvidenceInventory", () => {
  it("shows result counts, filters, and reset", async () => {
    const user = userEvent.setup();
    const bundle = getScenarioBundle(
      fixtureCatalog,
      "cedar-river-drought-surcharge",
    );
    if (!bundle) {
      throw new Error("Expected Cedar River bundle");
    }

    render(
      <EvidenceInventory
        sources={bundle.evidenceSources}
        claims={bundle.claims}
      />,
    );

    expect(
      screen.getByText(`${bundle.evidenceSources.length} sources`),
    ).toBeInTheDocument();
    expect(screen.getByText(/not a truth score/i)).toBeInTheDocument();

    await user.selectOptions(
      screen.getByLabelText(/Research review status/i),
      "rejected",
    );
    expect(screen.getByText("1 source")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Reset to original order/i }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /Reset to original order/i }),
    );
    expect(
      screen.getByText(`${bundle.evidenceSources.length} sources`),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Sort inventory/i)).toHaveValue("original");
  });
});
