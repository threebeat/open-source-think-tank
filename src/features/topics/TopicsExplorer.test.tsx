import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { TopicsExplorer } from "@/features/topics/TopicsExplorer";
import { listTopics } from "@/domain/selectors";
import { fixtureCatalog } from "@/fixtures";

describe("TopicsExplorer", () => {
  it("filters local fixtures by search and stage", async () => {
    const user = userEvent.setup();
    render(<TopicsExplorer topics={listTopics(fixtureCatalog)} />);

    expect(screen.getByRole("link", { name: /Cedar River/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Millbrook/i })).toBeInTheDocument();

    await user.type(screen.getByLabelText(/Search topics/i), "northline");
    expect(screen.getByRole("link", { name: /Northline/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Millbrook/i })).not.toBeInTheDocument();

    await user.clear(screen.getByLabelText(/Search topics/i));
    await user.selectOptions(screen.getByLabelText(/^Stage$/i), "brief");
    expect(screen.getByRole("link", { name: /Millbrook/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Cedar River/i })).not.toBeInTheDocument();
  });
});
