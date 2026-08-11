import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TopicsExplorer } from "@/features/topics/TopicsExplorer";
import {
  applyTopicsSearch,
  DEFAULT_TOPICS_SEARCH,
  hasNonDefaultAdvancedFilters,
  parseTopicsSearchParams,
  topicsSearchToParams,
} from "@/features/topics/topics-search";
import { listTopics } from "@/domain/selectors";
import { fixtureCatalog } from "@/fixtures";

const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/topics",
  useSearchParams: () => mockSearchParams,
}));

let mockSearchParams = new URLSearchParams();

afterEach(() => {
  cleanup();
  replace.mockReset();
  mockSearchParams = new URLSearchParams();
});

describe("topics search helpers", () => {
  const topics = listTopics(fixtureCatalog);

  it("excludes proposed topics by default and includes them when opted in", () => {
    const activeOnly = applyTopicsSearch(topics, DEFAULT_TOPICS_SEARCH);
    expect(activeOnly.every((topic) => topic.discoveryState === "active")).toBe(
      true,
    );
    expect(
      activeOnly.some((topic) => topic.slug === "blount-greenway-priority-spurs"),
    ).toBe(false);

    const withProposed = applyTopicsSearch(topics, {
      ...DEFAULT_TOPICS_SEARCH,
      proposed: "include",
    });
    expect(
      withProposed.some((topic) => topic.slug === "blount-greenway-priority-spurs"),
    ).toBe(true);

    const proposedOnly = applyTopicsSearch(topics, {
      ...DEFAULT_TOPICS_SEARCH,
      proposed: "only",
    });
    expect(proposedOnly).toHaveLength(2);
    expect(
      proposedOnly.every((topic) => topic.discoveryState === "proposed"),
    ).toBe(true);
  });

  it("filters by statewide, all-counties, and specific county geography", () => {
    const statewide = applyTopicsSearch(topics, {
      ...DEFAULT_TOPICS_SEARCH,
      jurisdiction: "statewide",
    });
    expect(
      statewide.every((topic) => topic.jurisdictionLevel === "statewide"),
    ).toBe(true);
    expect(statewide.some((topic) => topic.slug === "cedar-river-drought-surcharge")).toBe(
      true,
    );

    const allCounties = applyTopicsSearch(topics, {
      ...DEFAULT_TOPICS_SEARCH,
      jurisdiction: "county",
      countyFips: "all",
    });
    expect(
      allCounties.every((topic) => topic.jurisdictionLevel === "county"),
    ).toBe(true);

    const shelby = applyTopicsSearch(topics, {
      ...DEFAULT_TOPICS_SEARCH,
      jurisdiction: "county",
      countyFips: "47157",
    });
    expect(shelby).toHaveLength(1);
    expect(shelby[0]?.slug).toBe("millbrook-ems-open-data");
  });

  it("searches human-readable geography and sanitizes unknown URL values", () => {
    const byGeography = applyTopicsSearch(topics, {
      ...DEFAULT_TOPICS_SEARCH,
      query: "knox county",
    });
    expect(byGeography.some((topic) => topic.slug === "northline-secondary-start-times")).toBe(
      true,
    );

    const parsed = parseTopicsSearchParams(
      new URLSearchParams(
        "jurisdiction=planet&county=99999&stage=nope&status=maybe&proposed=all&sort=priority",
      ),
    );
    expect(parsed).toEqual(DEFAULT_TOPICS_SEARCH);
    expect(hasNonDefaultAdvancedFilters(parsed)).toBe(false);

    const roundTrip = parseTopicsSearchParams(
      topicsSearchToParams({
        ...DEFAULT_TOPICS_SEARCH,
        query: " water ",
        jurisdiction: "county",
        countyFips: "47037",
        proposed: "include",
        sort: "title",
      }),
    );
    expect(roundTrip.query).toBe("water");
    expect(roundTrip.jurisdiction).toBe("county");
    expect(roundTrip.countyFips).toBe("47037");
    expect(roundTrip.proposed).toBe("include");
    expect(roundTrip.sort).toBe("title");
  });
});

describe("TopicsExplorer", () => {
  it("keeps advanced search collapsed and hides proposed topics until inclusion", async () => {
    const user = userEvent.setup();
    render(<TopicsExplorer topics={listTopics(fixtureCatalog)} />);

    expect(
      screen.getByRole("button", { name: /Advanced search/i }),
    ).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.getByRole("link", { name: /Cedar River/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Shelby County EMS/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Knox County secondary/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /Blount County greenway/i }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Advanced search/i }));
    expect(
      screen.getByRole("button", { name: /Hide advanced search/i }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByRole("heading", { name: /Advanced search/i }),
    ).toBeInTheDocument();

    await user.selectOptions(
      screen.getByLabelText(/Proposed topics/i),
      "include",
    );
    expect(replace).toHaveBeenCalled();
    const lastUrl = String(replace.mock.calls.at(-1)?.[0]);
    expect(lastUrl).toContain("proposed=include");
  });

  it("filters by stage, subject, and status through advanced controls", async () => {
    const user = userEvent.setup();
    mockSearchParams = new URLSearchParams("subject=education");
    render(<TopicsExplorer topics={listTopics(fixtureCatalog)} />);

    expect(
      screen.getByRole("button", { name: /Hide advanced search/i }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByRole("link", { name: /Knox County secondary/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /Shelby County EMS/i }),
    ).not.toBeInTheDocument();

    const chips = screen.getByRole("list", { name: /Active filters/i });
    expect(within(chips).getByRole("button", { name: /Subject: education/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Clear all/i }));
    expect(replace).toHaveBeenCalledWith("/topics", { scroll: false });
  });
});
