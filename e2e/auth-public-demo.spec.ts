import { expect, test } from "@playwright/test";

test.describe("auth isolation in public-demo", () => {
  test("account page redirects home and auth APIs 404", async ({ page }) => {
    await page.goto("/account");
    await expect(page).toHaveURL(/\/$/);

    const accept = await page.request.post("/api/auth/accept-invite", {
      data: {
        inviteToken: "ostt-synth-invite-token-cory",
        contactChannel: "cory@ostt.synth.test",
      },
    });
    expect(accept.status()).toBe(404);

    const nextAuth = await page.request.get("/api/auth/session");
    expect(nextAuth.status()).toBe(404);
  });

  test("public join preview still cannot enroll", async ({ page }) => {
    await page.goto("/join");
    await page.getByRole("button", { name: /Stronger verification/i }).click();
    await expect(
      page.getByRole("button", { name: "Create account (disabled)" }),
    ).toBeDisabled();
  });
});
