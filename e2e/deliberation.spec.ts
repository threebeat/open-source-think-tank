import { expect, test } from "@playwright/test";

test.describe("deliberation observer", () => {
  test("unauthenticated deliberation URLs redirect to the Commonhall landing", async ({
    page,
  }) => {
    await page.goto("/deliberation/cedar-river-drought-surcharge");
    await expect(page).toHaveURL(/\/auth\/sign-in/);
  });
});
