import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("about", () => {
  test("shows mission and synthetic nonprofit contact", async ({ page }) => {
    await page.goto("/about");
    await expect(page).toHaveURL(/\/about$/);
    await expect(page.getByRole("heading", { name: "About Commonhall" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Mission" })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Nonprofit workshop contact" }),
    ).toBeVisible();
    await expect(page.getByText("hello@commonhall.example")).toBeVisible();
    await expect(page.getByText(/synthetic/i).first()).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();
    const serious = results.violations.filter((violation) =>
      ["serious", "critical"].includes(violation.impact ?? ""),
    );
    expect(serious).toEqual([]);
  });
});
