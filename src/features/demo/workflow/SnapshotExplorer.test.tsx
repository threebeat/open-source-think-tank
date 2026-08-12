import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SnapshotExplorer } from "@/features/demo/workflow/SnapshotExplorer";

const replace = vi.fn();
let searchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/demo/workflow",
  useSearchParams: () => searchParams,
}));

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  replace.mockReset();
  searchParams = new URLSearchParams();
});

describe("SnapshotExplorer", () => {
  it("renders participant synthetic labels and switches preview without live-action claims", async () => {
    const user = userEvent.setup();
    render(<SnapshotExplorer />);

    expect(
      screen.getByRole("heading", {
        name: "Explore example staff and visitor states",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Synthetic role preview — participant submission/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/You held this/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Action completed/i)).not.toBeInTheDocument();

    await user.selectOptions(
      screen.getByLabelText("Synthetic preview view"),
      "moderation",
    );

    expect(replace).toHaveBeenCalled();
    const replaceArg = String(replace.mock.calls.at(-1)?.[0] ?? "");
    expect(replaceArg).toContain("task=explore");
    expect(replaceArg).toContain("view=moderation");

    // Re-render as if the router applied the URL change.
    searchParams = new URLSearchParams(
      "task=explore&view=moderation&state=held",
    );
    cleanup();
    render(<SnapshotExplorer />);

    const moderation = screen.getByTestId("workflow-preview-moderation");
    expect(
      within(moderation).getByTestId("workflow-moderation-state-label"),
    ).toHaveTextContent("Example held state");
    expect(
      within(moderation).getByText(/Preview next state: hidden/i),
    ).toBeInTheDocument();
    expect(
      within(moderation).getByText(/Synthetic role preview — moderation/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/You held this/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Action completed/i)).not.toBeInTheDocument();
  });

  it("shows visitor empty published shell without inventing excluded bodies", () => {
    searchParams = new URLSearchParams("view=visitor&state=empty");
    render(<SnapshotExplorer />);
    const visitor = screen.getByTestId("workflow-preview-visitor");
    expect(
      within(visitor).getByText(/No currently included claims or evidence/i),
    ).toBeInTheDocument();
    expect(
      within(visitor).queryByText(
        /Metered drought surcharge reduces peak residential use/i,
      ),
    ).not.toBeInTheDocument();
  });

  it("shows visitor projection labels for held state without claiming live users", () => {
    searchParams = new URLSearchParams("view=visitor&state=held");
    render(<SnapshotExplorer />);

    const visitor = screen.getByTestId("workflow-preview-visitor");
    expect(
      within(visitor).getByText(
        /Synthetic role preview — visitor public projection/i,
      ),
    ).toBeInTheDocument();
    expect(
      within(visitor).getByTestId("workflow-visitor-state-label"),
    ).toHaveTextContent(/Visitor view during example held state/i);
    expect(
      within(visitor).getByText(
        /Claim body is absent from this projection while held/i,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/You held this/i)).not.toBeInTheDocument();
  });
});
