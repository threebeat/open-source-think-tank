import { expect, test } from "@playwright/test";

test.describe("3.10 gated public interface", () => {
  test("unauthenticated formal-topics redirect to sign-in", async ({ page }) => {
    await page.goto("/formal-topics");
    await expect(page).toHaveURL(/\/auth\/sign-in/);
  });

  test("authenticated legacy formal-topics redirect to Agenda", async ({
    page,
  }) => {
    const { signInWithCapturedEmail } = await import("./gated-helpers");
    await signInWithCapturedEmail(page, "staff-admin@ostt.synth.test");
    await page.goto("/formal-topics");
    await expect(page).toHaveURL(/\/agenda$/);
    await expect(page.getByRole("heading", { name: "Agenda" })).toBeVisible();
    await expect(page.getByTestId("hosted-polis-unavailable")).toBeVisible();
    await expect(
      page.getByText(/opens in a later commonhall phase/i),
    ).toHaveCount(0);
  });
});
