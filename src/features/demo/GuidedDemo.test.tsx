import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GuidedDemo } from "@/features/demo/GuidedDemo";
import { DEMO_STEP_KEY } from "@/features/demo/demo-storage";

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
  it("advances, toggles presenter notes, persists step, and resets local state", async () => {
    const user = userEvent.setup();
    render(<GuidedDemo />);

    expect(
      await screen.findByRole("heading", {
        name: /Start: synthetic demonstration only/i,
      }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Next" }));
    const joinHeading = screen.getByRole("heading", { name: "Join preview" });
    expect(joinHeading).toBeInTheDocument();
    expect(joinHeading).toHaveFocus();
    expect(window.sessionStorage.getItem(DEMO_STEP_KEY)).toBe("1");
    expect(
      screen.getByRole("link", { name: "Open join preview" }),
    ).toHaveAttribute("href", "/join?demoStep=join");

    await user.click(screen.getByRole("button", { name: "Show presenter notes" }));
    expect(screen.getByLabelText("Presenter notes")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Reset" }));
    expect(
      screen.getByRole("heading", {
        name: /Start: synthetic demonstration only/i,
      }),
    ).toBeInTheDocument();
    expect(window.sessionStorage.getItem(DEMO_STEP_KEY)).toBe("0");
    expect(screen.queryByLabelText("Presenter notes")).not.toBeInTheDocument();
  });
});
