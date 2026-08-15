import { expect, test } from "@playwright/test";

test.describe("progressive evidence disclosure", () => {
  test("unauthenticated formal-topic evidence URLs redirect to the Commonhall landing", async ({
    page,
  }) => {
    await page.goto(
      "/formal-topics/cedar-river-drought-surcharge?section=evidence",
    );
    await expect(page).toHaveURL(/\/auth\/sign-in/);
  });
});
