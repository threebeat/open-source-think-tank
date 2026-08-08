import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StageBadge } from "@/components/StageBadge";

describe("StageBadge", () => {
  it("renders a human-readable stage label", () => {
    render(<StageBadge stage="consultation" />);
    expect(screen.getByText("Consultation")).toBeInTheDocument();
  });
});
