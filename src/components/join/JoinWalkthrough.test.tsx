import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { JoinWalkthrough } from "@/components/join/JoinWalkthrough";

describe("JoinWalkthrough", () => {
  it("shows every intended consent and verification step without a working submit", async () => {
    const user = userEvent.setup();
    render(<JoinWalkthrough />);

    expect(screen.getByRole("button", { name: /Eligibility/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Bot resistance/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Account continuity/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Uniqueness/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Conduct assent/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Privacy consent/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Stronger verification/i }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Privacy consent/i }));
    expect(screen.getByText("Not legally reviewed")).toBeInTheDocument();
    expect(
      screen.getByText(/does not collect information/i),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Uniqueness/i }));
    expect(
      screen.getByText(/identification documents will necessarily be required/i),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Stronger verification/i }));
    expect(
      screen.getByRole("button", { name: "Create account (disabled)" }),
    ).toBeDisabled();
  });
});

