import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GuidedDemo } from "@/features/demo/GuidedDemo";
import { DEMO_STEP_KEY } from "@/features/demo/demo-storage";
import { IDEA_COMMONS_STORAGE_KEY } from "@/features/idea-commons/idea-commons-storage";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
});

beforeEach(() => {
  window.sessionStorage.clear();
  push.mockReset();
});

describe("GuidedDemo", () => {
  it("advances the computational-democracy journey and resets local state", async () => {
    const user = userEvent.setup();
    window.sessionStorage.setItem(
      IDEA_COMMONS_STORAGE_KEY,
      JSON.stringify({
        posts: [
          {
            id: "practice-1",
            kind: "discussion",
            title: "Temp",
            body: "Temp body",
            citedSourceTitle: "",
            parentId: null,
            createdAt: "2026-08-13T00:00:00.000Z",
          },
        ],
      }),
    );
    render(<GuidedDemo />);

    expect(
      await screen.findByRole("heading", {
        name: /Follow an idea from community discussion to collective action/i,
      }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Next" }));
    const ideaHeading = screen.getByRole("heading", {
      name: "1. Idea Commons discussion",
    });
    expect(ideaHeading).toBeInTheDocument();
    expect(ideaHeading).toHaveFocus();
    expect(window.sessionStorage.getItem(DEMO_STEP_KEY)).toBe("1");
    expect(screen.getByRole("link", { name: "Open Idea Commons" })).toHaveAttribute(
      "href",
      "/idea-commons?demoStep=idea-commons",
    );

    await user.click(screen.getByRole("button", { name: "Show presenter notes" }));
    expect(screen.getByLabelText("Presenter notes")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Reset" }));
    expect(
      screen.getByRole("heading", {
        name: /Follow an idea from community discussion to collective action/i,
      }),
    ).toBeInTheDocument();
    expect(window.sessionStorage.getItem(DEMO_STEP_KEY)).toBe("0");
    expect(window.sessionStorage.getItem(IDEA_COMMONS_STORAGE_KEY)).toBeNull();
    expect(screen.queryByLabelText("Presenter notes")).not.toBeInTheDocument();
  });
});
