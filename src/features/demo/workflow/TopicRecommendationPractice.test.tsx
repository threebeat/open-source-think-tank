import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TopicRecommendationPractice } from "@/features/demo/workflow/TopicRecommendationPractice";
import { clearWorkflowPractice } from "@/features/demo/workflow/workflow-storage";

const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/demo/workflow",
  useSearchParams: () =>
    new URLSearchParams("task=topic-recommendation&step=choose"),
}));

describe("TopicRecommendationPractice", () => {
  beforeEach(() => {
    replace.mockReset();
    clearWorkflowPractice();
  });

  it("requires a topic idea before continuing", async () => {
    const user = userEvent.setup();
    render(<TopicRecommendationPractice step="choose" />);

    expect(
      screen.getByText(/Synthetic topic-recommendation practice/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Stored in this browser session only/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Not submitted to the alpha/i),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(
      screen.getByRole("alert"),
    ).toHaveTextContent(/Select a synthetic topic idea/i);
    expect(replace).not.toHaveBeenCalled();

    await user.click(
      screen.getByRole("radio", {
        name: /School bus electrification timelines/i,
      }),
    );
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(replace).toHaveBeenCalledWith(
      "/demo/workflow?task=topic-recommendation&step=scope",
      { scroll: false },
    );
  });
});
