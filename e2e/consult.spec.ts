import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("simulated consultation", () => {
  test("keyboard-votes all responses, announces changes, and opens sealed report", async ({
    page,
  }) => {
    await page.goto("/topics/cedar-river-drought-surcharge/consult");
    await expect(
      page.getByText(/not a live Pol\.is conversation/i),
    ).toBeVisible();

    const voteGroup = page.getByRole("group", {
      name: "Respond to this statement",
    });
    const liveRegion = page.getByRole("status", {
      name: "Public input practice updates",
    });

    const agree = voteGroup.getByRole("button", { name: "Agree", exact: true });
    await agree.focus();
    await expect(agree).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(liveRegion).toContainText(/Recorded agree/i);
    await expect(liveRegion).toContainText(/Now viewing statement 2/i);

    const disagree = voteGroup.getByRole("button", {
      name: "Disagree",
      exact: true,
    });
    await disagree.focus();
    await expect(disagree).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(liveRegion).toContainText(/Recorded disagree/i);
    await expect(liveRegion).toContainText(/Now viewing statement 3/i);

    const pass = voteGroup.getByRole("button", { name: "Pass", exact: true });
    await pass.focus();
    await expect(pass).toBeFocused();
    await page.keyboard.press("Space");
    await expect(liveRegion).toContainText(/Recorded pass/i);
    await expect(liveRegion).toContainText(/Now viewing statement 4/i);

    await page.getByRole("button", { name: "Open synthetic report" }).click();
    const report = page.getByRole("region", {
      name: "Fixed synthetic consultation report",
    });
    await expect(report).toBeVisible();
    await expect(
      report.getByText("Group A, Group B, Group C", { exact: true }),
    ).toBeVisible();
    await expect(
      report.getByText("Not a representative sample", { exact: true }),
    ).toBeVisible();
    await expect(
      report.getByText("Consensus is not proof", { exact: true }),
    ).toBeVisible();
    await expect(
      report.getByRole("heading", { name: "All statements and evidence links" }),
    ).toBeVisible();

    const evidenceLink = report
      .getByRole("link", { name: /Evidence \(rejected\):/i })
      .first();
    await expect(evidenceLink).toHaveAttribute(
      "href",
      /\/topics\/cedar-river-drought-surcharge#evidence-/,
    );

    const accessibility = await new AxeBuilder({ page })
      .include("main")
      .analyze();
    expect(
      accessibility.violations.filter(
        (violation) =>
          violation.impact === "serious" || violation.impact === "critical",
      ),
    ).toEqual([]);
  });
});
