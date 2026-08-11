import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

async function expectNoSeriousAxe(page: import("@playwright/test").Page, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  const serious = results.violations.filter((v) =>
    ["serious", "critical"].includes(v.impact ?? ""),
  );
  expect(serious, `${label}: ${serious.map((v) => v.id).join(", ")}`).toEqual(
    [],
  );
}

async function completeInviteSession(
  page: import("@playwright/test").Page,
  inviteToken: string,
  contactChannel: string,
) {
  const accept = await page.request.post("/api/auth/accept-invite", {
    data: { inviteToken, contactChannel },
  });
  expect(accept.ok()).toBeTruthy();

  const capture = await page.request.get("/api/test/last-email");
  const mail = (await capture.json()) as { textBody?: string };
  const tokenMatch = mail.textBody!.match(/token=([^&\s]+)/);
  const token = decodeURIComponent(tokenMatch![1]!);
  await page.goto(`/auth/complete?token=${encodeURIComponent(token)}`);
  await expect(page).toHaveURL(/\/account/, { timeout: 30_000 });
}

async function signInWithCapturedEmail(
  page: import("@playwright/test").Page,
  contactChannel: string,
) {
  const request = await page.request.post("/api/auth/request-sign-in", {
    data: { contactChannel },
  });
  expect(request.ok(), await request.text()).toBeTruthy();
  const capture = await page.request.get("/api/test/last-email");
  expect(capture.ok()).toBeTruthy();
  const mail = (await capture.json()) as { textBody?: string };
  const tokenMatch = mail.textBody!.match(/token=([^&\s]+)/);
  expect(tokenMatch?.[1]).toBeTruthy();
  const token = decodeURIComponent(tokenMatch![1]!);
  await page.goto(`/auth/complete?token=${encodeURIComponent(token)}`);
  await expect(page).toHaveURL(/\/account/, { timeout: 30_000 });
}

/**
 * Gated account/staff axe coverage required for 2.12 readiness.
 * Runs only under playwright.gated.config.ts with prepared synthetic DB.
 */
test.describe("gated account and staff accessibility", () => {
  test("account privacy and onboarding surfaces have no serious axe violations", async ({
    page,
  }) => {
    await completeInviteSession(
      page,
      "ostt-synth-invite-token-eliot",
      "eliot@ostt.synth.test",
    );

    await page.goto("/account/privacy");
    await expect(
      page.getByRole("heading", { name: /privacy controls/i }),
    ).toBeVisible();
    await expectNoSeriousAxe(page, "/account/privacy");

    await page.goto("/account/onboarding");
    await expect(
      page.getByRole("heading", { name: /onboarding progress/i }),
    ).toBeVisible();
    await expectNoSeriousAxe(page, "/account/onboarding");

    await page.goto("/account/assent");
    await expect(page.getByText(/assent/i).first()).toBeVisible();
    await expectNoSeriousAxe(page, "/account/assent");
  });

  test("staff onboarding queue has no serious axe violations", async ({
    page,
  }) => {
    await signInWithCapturedEmail(page, "staff-admin@ostt.synth.test");
    await page.goto("/staff/onboarding");
    await expect(
      page.getByRole("heading", {
        name: /invitation and onboarding status|onboarding queues/i,
      }),
    ).toBeVisible({ timeout: 15_000 });
    await expectNoSeriousAxe(page, "/staff/onboarding");
  });
});
