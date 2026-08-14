import { expect, test } from "@playwright/test";

test.describe("canonical formal topic page", () => {
  test("unauthenticated formal-topic URLs redirect to the Commonhall landing", async ({
    page,
  }) => {
    await page.goto("/formal-topics/cedar-river-drought-surcharge");
    await expect(page).toHaveURL(/\/$/);
  });
});
