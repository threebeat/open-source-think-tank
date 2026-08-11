import { expect, test } from "@playwright/test";

/**
 * Runs only under playwright.gated.config.ts with APP_MODE=gated,
 * migrated DB, and AUTH_SECRET set. Uses synthetic invite fixtures only.
 */
test.describe("gated auth lifecycle (synthetic)", () => {
  test("invite accept → contact verify → account page; active capability denied", async ({
    page,
  }) => {
    // Unauthenticated capability probe (isolated from browser cookies).
    const unauthenticated = await page.request.post(
      "/api/account/active-capability",
    );
    expect(unauthenticated.status()).toBe(401);

    // Prepare script reseeds before the server starts (single-use invite).
    const accept = await page.request.post("/api/auth/accept-invite", {
      data: {
        inviteToken: "ostt-synth-invite-token-cory",
        contactChannel: "cory@ostt.synth.test",
      },
    });
    expect(accept.ok()).toBeTruthy();

    const capture = await page.request.get("/api/test/last-email");
    expect(capture.ok()).toBeTruthy();
    const mail = (await capture.json()) as { textBody?: string };
    expect(mail.textBody).toBeTruthy();
    const tokenMatch = mail.textBody!.match(/token=([^&\s]+)/);
    expect(tokenMatch?.[1]).toBeTruthy();
    const token = decodeURIComponent(tokenMatch![1]!);

    await page.goto(`/auth/complete?token=${encodeURIComponent(token)}`);
    await expect(page).toHaveURL(/\/account$/, { timeout: 30_000 });
    await expect(page.getByText("pending_onboarding")).toBeVisible();

    // Authenticated pending_onboarding must use the page cookie jar.
    const pendingCapability = await page.request.post(
      "/api/account/active-capability",
    );
    expect(pendingCapability.status()).toBe(403);
  });

  test("unauthenticated account URL is insufficient", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/account");
    await expect(page).toHaveURL(/\/auth\/sign-in$/);
  });
});
