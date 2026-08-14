import { expect, test } from "@playwright/test";

const phoneWidths = [320, 375, 390, 430] as const;

test.describe("responsive smoke", () => {
  for (const width of phoneWidths) {
    test(`home and demo remain usable at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 720 });
      await page.goto("/");
      await expect(
        page.getByRole("heading", { name: "Commonhall" }),
      ).toBeVisible();
      await expect(
        page.getByText(
          "Pre-alpha Commonhall — synthetic data only. Not a government or nonprofit membership.",
        ),
      ).toBeVisible();

      await page.goto("/demo");
      await expect(
        page.getByRole("heading", { name: "Tour Commonhall" }),
      ).toBeVisible();
      await expect(page.getByRole("button", { name: "Next" })).toBeVisible();
      await page.getByRole("button", { name: "Next" }).click();
      await expect(
        page.getByRole("heading", { name: "2. Public Agenda" }),
      ).toBeVisible();
    });
  }
});
