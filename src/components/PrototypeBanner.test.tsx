import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PrototypeBanner } from "@/components/PrototypeBanner";

describe("PrototypeBanner", () => {
  it("states that the demonstration uses synthetic data only", () => {
    render(<PrototypeBanner />);

    expect(
      screen.getByText("Demonstration — synthetic data only."),
    ).toBeInTheDocument();
  });
});
