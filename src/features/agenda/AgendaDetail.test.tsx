import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AgendaDetail } from "@/features/agenda/AgendaDetail";
import { AGENDA_STATES } from "@/domain/status";
import {
  getAgendaItemBySlug,
  getTopicById,
  listAgendaItems,
} from "@/domain/selectors";
import { fixtureCatalog } from "@/fixtures";

afterEach(() => {
  cleanup();
});

describe("AgendaDetail", () => {
  it("covers every agenda status with separate thresholds and human review", () => {
    for (const state of AGENDA_STATES) {
      const item = listAgendaItems(fixtureCatalog).find(
        (candidate) => candidate.state === state,
      );
      expect(item, `Missing agenda fixture for state ${state}`).toBeDefined();
      if (!item) {
        continue;
      }
      const topic = getTopicById(fixtureCatalog, item.topicId);
      expect(topic).toBeDefined();
      if (!topic) {
        continue;
      }

      const { unmount } = render(<AgendaDetail item={item} topic={topic} />);
      expect(screen.getAllByText(new RegExp(state, "i")).length).toBeGreaterThan(
        0,
      );
      expect(
        screen.getByRole("heading", { name: "Public Criteria" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("heading", { name: "How This Result Was Calculated" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("heading", { name: "Human review" }),
      ).toBeInTheDocument();
      expect(
        screen.getByText("No combined truth score", { exact: true }),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Popularity alone does not determine the agenda/i),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: /Open public input report path/i }),
      ).toHaveAttribute("href", `/topics/${topic.slug}/consult`);
      expect(
        screen.getByRole("link", { name: /Open fact-check & research record/i }),
      ).toHaveAttribute("href", `/topics/${topic.slug}`);
      unmount();
    }
  });

  it("shows the deferred example as a non-override of evidence concerns", () => {
    const item = getAgendaItemBySlug(
      fixtureCatalog,
      "cedar-river-billing-ops-gap",
    );
    const topic = item
      ? getTopicById(fixtureCatalog, item.topicId)
      : undefined;
    expect(item?.state).toBe("deferred");
    expect(topic).toBeDefined();
    if (!item || !topic) {
      return;
    }

    render(<AgendaDetail item={item} topic={topic} />);
    const review = screen.getByRole("region", { name: "Human review" });
    expect(
      within(review).getByText(
        /did not override the failed evidence-readiness gate/i,
      ),
    ).toBeInTheDocument();
  });
});
