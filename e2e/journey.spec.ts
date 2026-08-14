import { expect, test } from "@playwright/test";

const gatedProductPaths = [
  "/commons",
  "/agenda",
  "/chamber",
  "/council",
  "/records",
  "/account",
  "/idea-commons",
  "/formal-topics",
  "/process",
  "/topics",
  "/deliberation/cedar-river-drought-surcharge",
  "/decisions/cedar-river-drought-surcharge",
  "/transparency",
] as const;

test.describe("unauthenticated product gate", () => {
  for (const path of gatedProductPaths) {
    test(`${path} redirects to the Commonhall landing in public-demo`, async ({
      page,
    }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/$/);
      await expect(page.getByRole("heading", { name: "Commonhall" })).toBeVisible();
    });
  }
});
