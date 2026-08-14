import { expect, test } from "@playwright/test";

test.describe("topics and evidence", () => {
  test("unauthenticated /topics redirects to the Commonhall landing", async ({
    page,
  }) => {
    await page.goto("/topics");
    await expect(page).toHaveURL(/\/$/);
  });
});
