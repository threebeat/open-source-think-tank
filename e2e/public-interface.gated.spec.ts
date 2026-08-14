import { expect, test } from "@playwright/test";

test.describe("3.10 gated public interface", () => {
  test("unauthenticated formal-topics redirect to sign-in", async ({ page }) => {
    await page.goto("/formal-topics");
    await expect(page).toHaveURL(/\/auth\/sign-in/);
  });

  test("authenticated legacy formal-topics redirect to Commons", async ({
    page,
  }) => {
    const { signInWithCapturedEmail } = await import("./gated-helpers");
    await signInWithCapturedEmail(page, "staff-admin@ostt.synth.test");
    await page.goto("/formal-topics");
    await expect(page).toHaveURL(/\/commons/);
    await expect(page.getByRole("heading", { name: "Commons", exact: true })).toBeVisible();
    await expect(
      page.getByText(
        /Informal conversations may not have been reviewed by a moderator/,
      ),
    ).toBeVisible();
    await expect(
      page.getByText(/opens in a later commonhall phase/i),
    ).toHaveCount(0);
  });
});
