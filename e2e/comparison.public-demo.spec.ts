import { expect, test } from "@playwright/test";

test.describe("public-demo evidence comparison", () => {
  test("unauthenticated formal-topics URLs redirect to the Commonhall landing", async ({
    page,
  }) => {
    await page.goto("/formal-topics");
    await expect(page).toHaveURL(/\/$/);
  });
});
