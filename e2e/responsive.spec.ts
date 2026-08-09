import { expect, test } from "@playwright/test";

const phoneWidths = [320, 375, 390, 430] as const;

test.describe("responsive smoke", () => {
  for (const width of phoneWidths) {
    test(`home and demo remain usable at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 720 });
      await page.goto("/");
      await expect(
        page.getByRole("heading", { name: "Open-Source Think Tank" }),
      ).toBeVisible();
      await expect(
        page.getByText("Demonstration — synthetic data only."),
      ).toBeVisible();

      await page.goto("/demo");
      await expect(
        page.getByRole("heading", { name: "Guided demo", exact: true }),
      ).toBeVisible();
      await expect(page.getByRole("button", { name: "Next" })).toBeVisible();
      await page.getByRole("button", { name: "Next" }).click();
      await expect(
        page.getByRole("heading", { name: "Join preview" }),
      ).toBeVisible();
    });
  }

  test("decision roll call remains readable in phone landscape", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 740, height: 360 });
    await page.goto("/decisions/cedar-river-drought-surcharge");
    await expect(
      page.getByRole("heading", { name: "Policy Council roll call" }),
    ).toBeVisible();
    await expect(page.getByText("Hugo Ren", { exact: true })).toBeVisible();
  });
});
