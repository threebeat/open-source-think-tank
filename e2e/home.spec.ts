import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("home smoke", () => {
  test("shows the synthetic-data banner and has no serious a11y violations", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(
      page.getByText("Demonstration — synthetic data only."),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Open-Source Think Tank" }),
    ).toBeVisible();
    await expect(
      page.getByText("Commonhall v2 is not operational yet"),
    ).toBeVisible();
    await expect(
      page.getByText("hosted Pol.is are not operational"),
    ).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();
    const seriousOrWorse = results.violations.filter((violation) =>
      ["serious", "critical"].includes(violation.impact ?? ""),
    );

    expect(seriousOrWorse).toEqual([]);
  });
});
