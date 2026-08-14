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
  "/formal-topics/cedar-river-drought-surcharge",
  "/process",
  "/topics",
  "/topics/cedar-river-drought-surcharge/consult",
  "/deliberation/cedar-river-drought-surcharge",
  "/decisions/cedar-river-drought-surcharge",
  "/transparency",
  "/actions/cedar-river-drought-surcharge",
] as const;

test.describe("unauthenticated product gate", () => {
  for (const path of gatedProductPaths) {
    test(`${path} redirects to the Commonhall landing in public-demo`, async ({
      page,
    }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/$/);
      await expect(page.getByRole("heading", { name: "Commonhall" })).toBeVisible();
      await expect(
        page.getByRole("link", { name: "Tour the demo" }).first(),
      ).toBeVisible();
    });
  }
});
