import { expect, test } from "@playwright/test";

test.describe("simulated consultation", () => {
  test("unauthenticated consultation URLs redirect to the Commonhall landing", async ({
    page,
  }) => {
    await page.goto("/topics/cedar-river-drought-surcharge/consult");
    await expect(page).toHaveURL(/\/$/);
  });
});
