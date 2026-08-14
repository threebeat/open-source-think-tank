import { expect, test } from "@playwright/test";

test.describe("phase-1 manual QA automation", () => {
  test("keyboard activates demo Next and moves focus to the step heading", async ({
    page,
  }) => {
    await page.goto("/demo");
    const next = page.getByRole("button", { name: "Next" });
    await next.focus();
    await expect(next).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("heading", { name: "2. Qualification" }),
    ).toBeFocused();
  });

  test("landing remains usable at phone width with reduced motion", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 390, height: 720 });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Commonhall" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Tour the demo" })).toBeVisible();
  });
});
