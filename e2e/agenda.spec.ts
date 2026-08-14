import { expect, test } from "@playwright/test";

test.describe("agenda gate", () => {
  test("unauthenticated /agenda redirects to the Commonhall landing", async ({
    page,
  }) => {
    await page.goto("/agenda");
    await expect(page).toHaveURL(/\/$/);
  });
});
