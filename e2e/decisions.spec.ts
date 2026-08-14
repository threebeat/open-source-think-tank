import { expect, test } from "@playwright/test";

test.describe("decision record and transparency", () => {
  test("unauthenticated decision URLs redirect to the Commonhall landing", async ({
    page,
  }) => {
    await page.goto("/decisions/cedar-river-drought-surcharge");
    await expect(page).toHaveURL(/\/$/);
  });
});
