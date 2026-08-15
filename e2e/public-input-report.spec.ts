import { expect, test } from "@playwright/test";

test.describe("public-demo Public Input report (4.4)", () => {
  test("unauthenticated report URLs redirect to the Commonhall landing", async ({
    page,
  }) => {
    await page.goto(
      "/formal-topics/cedar-river-drought-surcharge/consultation/report",
    );
    await expect(page).toHaveURL(/\/auth\/sign-in/);
  });
});
