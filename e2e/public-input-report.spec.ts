import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { expectNoHorizontalOverflow } from "./gated-helpers";

test.describe("public-demo Public Input report (4.4)", () => {
  test("canonical report route renders synthetic aggregate panel without iframe", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(
      "/formal-topics/cedar-river-drought-surcharge/consultation/report",
    );

    const panel = page.getByTestId("public-input-report-panel");
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute("data-synthetic", "true");
    await expect(page.locator("iframe")).toHaveCount(0);
    await expect(page.getByText(/not a decision-maker/i).first()).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();
    const seriousOrWorse = results.violations.filter((violation) =>
      ["serious", "critical"].includes(violation.impact ?? ""),
    );
    expect(seriousOrWorse).toEqual([]);
  });

  test("report route is keyboard reachable from consultation surface at 390px", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(
      "/formal-topics/cedar-river-drought-surcharge/consultation?fixtureState=closed",
    );
    await expect(page.getByTestId("consultation-surface")).toBeVisible();
    await page.getByTestId("consultation-report-link").click();
    await expect(page).toHaveURL(/\/consultation\/report$/);
    await expect(page.getByTestId("public-input-report-panel")).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("draft-like missing report for unknown slug is not-found", async ({
    page,
  }) => {
    const response = await page.goto(
      "/formal-topics/does-not-exist-topic/consultation/report",
    );
    expect(response?.status()).toBe(404);
  });
});
