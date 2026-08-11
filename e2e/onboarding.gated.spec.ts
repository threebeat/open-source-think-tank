import AxeBuilder from "@axe-core/playwright";
import { expect, test, devices } from "@playwright/test";

/**
 * Gated onboarding E2E — synthetic fixtures only.
 * Requires playwright.gated.config.ts + prepared DB.
 * Each enrollment test uses an independent pending invite fixture.
 */
test.describe("gated onboarding flows (synthetic)", () => {
  test("expired invite link cannot begin enrollment", async ({ page }) => {
    await page.goto("/auth/accept?token=definitely-expired-or-unknown-token");
    await expect(
      page.getByText(/invalid|expired|revoked|not found|invite/i).first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("uninvited visitor cannot begin enrollment from /join", async ({
    page,
  }) => {
    await page.goto("/join");
    await expect(page.getByRole("heading", { name: /join with an invitation/i })).toBeVisible();
    await expect(page.getByText(/self-registration is disabled/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /accept invitation/i })).toBeVisible();
  });

  test("invite → verify → onboarding/assent/verification keyboard + a11y", async ({
    page,
  }) => {
    // Distinct from auth-lifecycle.gated (cory) — invites are single-use.
    const accept = await page.request.post("/api/auth/accept-invite", {
      data: {
        inviteToken: "ostt-synth-invite-token-frank",
        contactChannel: "frank@ostt.synth.test",
      },
    });
    expect(accept.ok(), await accept.text()).toBeTruthy();

    const capture = await page.request.get("/api/test/last-email");
    const mail = (await capture.json()) as { textBody?: string };
    const tokenMatch = mail.textBody!.match(/token=([^&\s]+)/);
    const token = decodeURIComponent(tokenMatch![1]!);

    await page.goto(`/auth/complete?token=${encodeURIComponent(token)}`);
    await expect(page).toHaveURL(/\/account/, { timeout: 30_000 });

    await page.goto("/account/onboarding");
    await expect(page.getByRole("heading", { name: /onboarding progress/i })).toBeVisible();

    // Refresh / back navigation
    await page.reload();
    await expect(page.getByRole("heading", { name: /onboarding progress/i })).toBeVisible();
    await page.goBack();
    await page.goForward();
    await expect(page.getByRole("heading", { name: /onboarding progress/i })).toBeVisible();

    // Keyboard: assert focus actually advances across interactive controls
    await page.locator("body").focus();
    const focusSequence: string[] = [];
    for (let i = 0; i < 6; i += 1) {
      await page.keyboard.press("Tab");
      const descriptor = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) {
          return "body";
        }
        const tag = el.tagName.toLowerCase();
        const role = el.getAttribute("role") ?? "";
        const name =
          el.getAttribute("aria-label") ||
          (el as HTMLElement).innerText?.trim().slice(0, 40) ||
          el.getAttribute("href") ||
          el.id ||
          "";
        return `${tag}|${role}|${name}`;
      });
      focusSequence.push(descriptor);
    }
    const uniqueFocused = new Set(focusSequence.filter((item) => item !== "body"));
    expect(
      uniqueFocused.size,
      `expected focus to advance across controls; got ${focusSequence.join(" -> ")}`,
    ).toBeGreaterThanOrEqual(2);

    const onboardingAxe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    const serious = onboardingAxe.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact ?? ""),
    );
    expect(serious, serious.map((v) => v.id).join(", ")).toEqual([]);

    await page.goto("/account/verification");
    await expect(page.getByRole("heading", { name: /^verification$/i })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /open a verification case/i }),
    ).toBeVisible();

    // Open eligibility case (session-scoped)
    await page.getByLabel(/assertion kind/i).selectOption("eligibility");
    await page.getByLabel(/assertion summary/i).fill(
      "Synthetic eligibility assertion for gated e2e.",
    );
    await page.getByRole("button", { name: /open case/i }).click();
    await expect(page.getByText(/eligibility/i).first()).toBeVisible();

    const verificationAxe = await new AxeBuilder({ page }).analyze();
    const vSerious = verificationAxe.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact ?? ""),
    );
    expect(vSerious, vSerious.map((v) => v.id).join(", ")).toEqual([]);
  });

  test("declined assent leaves activation blocked", async ({ page }) => {
    const accept = await page.request.post("/api/auth/accept-invite", {
      data: {
        inviteToken: "ostt-synth-invite-token-dana",
        contactChannel: "dana@ostt.synth.test",
      },
    });
    expect(accept.ok()).toBeTruthy();

    const capture = await page.request.get("/api/test/last-email");
    const mail = (await capture.json()) as { textBody?: string };
    const tokenMatch = mail.textBody!.match(/token=([^&\s]+)/);
    const token = decodeURIComponent(tokenMatch![1]!);
    await page.goto(`/auth/complete?token=${encodeURIComponent(token)}`);
    await expect(page).toHaveURL(/\/account/, { timeout: 30_000 });

    await page.goto("/account/assent");
    const review = page.getByRole("link", { name: /review full document/i }).first();
    await expect(review).toBeVisible();
    await review.click();
    await page.getByRole("button", { name: /present full document/i }).click();
    await page.getByRole("button", { name: /decline/i }).click();
    await expect(page).toHaveURL(/\/account\/assent/);
    await expect(page.getByText(/outcome:\s*declined/i)).toBeVisible();

    await page.goto("/account/onboarding");
    await expect(page.getByRole("button", { name: /activate account/i })).toBeDisabled();
  });
});

test("onboarding and verification remain usable on phone width", async ({
  page,
}) => {
  // Viewport-only (no nested test.use) — gated config runs single-worker.
  await page.setViewportSize(devices["iPhone 12"].viewport!);
  await page.goto("/join");
  await expect(page.getByRole("heading", { name: /join with an invitation/i })).toBeVisible();
  const box = await page.getByRole("heading", { name: /join with an invitation/i }).boundingBox();
  expect(box).toBeTruthy();
  expect(box!.width).toBeLessThanOrEqual(400);
});
