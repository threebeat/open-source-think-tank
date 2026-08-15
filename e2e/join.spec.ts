import { expect, test } from "@playwright/test";

test.describe("join", () => {
  test("shows a working create-account form", async ({ page }) => {
    await page.goto("/join");
    await expect(
      page.getByRole("heading", { name: "Create an account" }),
    ).toBeVisible();
    await expect(page.getByLabel(/identifier/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /create account/i }),
    ).toBeEnabled();
    await expect(page.getByRole("link", { name: "Sign in" }).first()).toBeVisible();
  });
});
