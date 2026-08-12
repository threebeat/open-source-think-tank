import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { WorkflowPreview } from "@/features/demo/workflow/WorkflowPreview";
import { clearWorkflowPractice } from "@/features/demo/workflow/workflow-storage";

const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/demo/workflow",
  useSearchParams: () => new URLSearchParams(),
}));

describe("WorkflowPreview practice home", () => {
  beforeEach(() => {
    replace.mockReset();
    clearWorkflowPractice();
  });

  it("leads with practice tasks and keeps the explorer secondary", async () => {
    const user = userEvent.setup();
    render(<WorkflowPreview />);

    expect(
      screen.getByRole("heading", {
        name: "Practice how someone would use the service",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Explore example staff and visitor states",
      }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Recommend a topic" }),
    );
    expect(replace).toHaveBeenCalledWith(
      "/demo/workflow?task=topic-recommendation",
      { scroll: false },
    );
  });
});
