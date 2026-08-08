import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("application shell", () => {
  test("shows banner and keyboard-reachable navigation", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByText("Demonstration — synthetic data only."),
    ).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Menu" }).click();
    const mobileNav = page.getByRole("navigation", { name: "Primary mobile" });
    await expect(mobileNav).toBeVisible();
    await mobileNav.getByRole("link", { name: "Process", exact: true }).click();
    await expect(page).toHaveURL(/\/process$/);
    await expect(page.getByRole("heading", { name: "Process" })).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();
    const seriousOrWorse = results.violations.filter((violation) =>
      ["serious", "critical"].includes(violation.impact ?? ""),
    );
    expect(seriousOrWorse).toEqual([]);
  });
});
