import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("progressive evidence disclosure", () => {
  test("evidence items default collapsed; expand reveals details without nested interactive summary", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(
      "/formal-topics/cedar-river-drought-surcharge?section=evidence",
    );

    await expect(
      page.getByRole("heading", { name: "Claims and approaches" }),
    ).toBeVisible();

    const disclosures = page.getByTestId("evidence-disclosure-details");
    await expect(disclosures.first()).toBeVisible();
    const count = await disclosures.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i += 1) {
      await expect(disclosures.nth(i)).not.toHaveAttribute("open", "");
    }

    // Source links must not be presented before expansion.
    await expect(page.getByTestId("evidence-source-link")).toHaveCount(0);

    const firstToggle = page
      .getByText("View evidence details and source")
      .first();
    await firstToggle.focus();
    await page.keyboard.press("Enter");
    await expect(disclosures.first()).toHaveAttribute("open", "");

    // Expanded panel may show unavailable source label for synthetic fixtures.
    await expect(
      page.getByTestId("evidence-disclosure-details-panel").first(),
    ).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();
    const seriousOrWorse = results.violations.filter((violation) =>
      ["serious", "critical"].includes(violation.impact ?? ""),
    );
    expect(seriousOrWorse).toEqual([]);
  });

  test("consultation surface is reachable and never loads an iframe", async ({
    page,
  }) => {
    await page.goto(
      "/formal-topics/cedar-river-drought-surcharge?section=discussions",
    );
    await page.getByTestId("consultation-surface-link").click();
    await expect(page).toHaveURL(/\/consultation$/);
    await expect(page.getByTestId("consultation-surface")).toBeVisible();
    await expect(page.getByTestId("embed-boundary-placeholder")).toBeVisible();
    await expect(page.locator("iframe")).toHaveCount(0);
  });
});
