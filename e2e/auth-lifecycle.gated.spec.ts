import { expect, test } from "@playwright/test";

/**
 * Runs only under playwright.gated.config.ts with APP_MODE=gated,
 * migrated DB, and AUTH_SECRET set. Uses synthetic invite fixtures only.
 */
test.describe("gated auth lifecycle (synthetic)", () => {
  test("invite accept → contact verify → account page; active capability denied", async ({
    page,
    request,
  }) => {
    // Prepare script reseeds before the server starts (single-use invite).
    const accept = await request.post("/api/auth/accept-invite", {
      data: {
        inviteToken: "ostt-synth-invite-token-cory",
        contactChannel: "cory@ostt.synth.test",
      },
    });
    expect(accept.ok()).toBeTruthy();

    const capture = await request.get("/api/test/last-email");
    expect(capture.ok()).toBeTruthy();
    const mail = (await capture.json()) as { textBody?: string };
    expect(mail.textBody).toBeTruthy();
    const tokenMatch = mail.textBody!.match(/token=([^&\s]+)/);
    expect(tokenMatch?.[1]).toBeTruthy();
    const token = decodeURIComponent(tokenMatch![1]!);

    await page.goto(`/auth/complete?token=${encodeURIComponent(token)}`);
    await expect(page).toHaveURL(/\/account$/);
    await expect(page.getByText("pending_onboarding")).toBeVisible();

    const capability = await request.post("/api/account/active-capability");
    expect(capability.status()).toBe(403);
  });

  test("unauthenticated account URL is insufficient", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/account");
    await expect(page).toHaveURL(/\/auth\/sign-in$/);
  });
});
