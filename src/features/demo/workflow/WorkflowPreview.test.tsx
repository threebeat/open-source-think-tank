import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WorkflowPreview } from "@/features/demo/workflow/WorkflowPreview";

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

describe("WorkflowPreview", () => {
  it("renders participant synthetic labels and switches preview without live-action claims", async () => {
    const user = userEvent.setup();
    render(<WorkflowPreview />);

    expect(
      screen.getByRole("heading", { name: "Synthetic preview" }),
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
    expect(replaceArg).toContain("view=moderation");

    // Re-render as if the router applied the URL change.
    searchParams = new URLSearchParams("view=moderation&state=held");
    cleanup();
    render(<WorkflowPreview />);

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

  it("shows visitor projection labels for held state without claiming live users", () => {
    searchParams = new URLSearchParams("view=visitor&state=held");
    render(<WorkflowPreview />);

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
