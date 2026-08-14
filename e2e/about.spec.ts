import { expect, test } from "@playwright/test";

test.describe("about", () => {
  test("redirects unauthenticated visitors to the Commonhall landing", async ({
    page,
  }) => {
    await page.goto("/about");
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { name: "Commonhall" })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Mission (proposed)" }),
    ).toBeVisible();
  });
});
