import { expect, test } from "@playwright/test";

import { expectNoHorizontalOverflow, signInWithCapturedEmail } from "./gated-helpers";

/**
 * Gated topic authoring workspace (3.4).
 * Requires playwright.gated.config.ts + prepared synthetic DB.
 */
test.describe("gated topic authoring", () => {
  test("administrator can create a draft and open it without a publish control", async ({
    page,
  }) => {
    await signInWithCapturedEmail(page, "staff-admin@ostt.synth.test");
    await page.goto("/workspace/topics");
    await expect(
      page.getByRole("heading", { name: /topic authoring/i }),
    ).toBeVisible();
    await expect(page.getByText(/operational workflow/i).first()).toBeVisible();
    await expect(page.getByText(/publication status/i).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /publish/i })).toHaveCount(0);
    await expectNoHorizontalOverflow(page);

    await page.goto("/workspace/topics/new");
    await expect(
      page.getByRole("heading", { name: /create draft topic/i }),
    ).toBeVisible();
    const slug = `e2e-topic-${Date.now()}`;
    await page.locator("#topic-slug").fill(slug);
    await page.locator("#topic-title").fill("E2E draft topic");
    await page.locator("#topic-question").fill("What should the e2e topic ask?");
    await page.locator("#topic-background").fill("Background for gated e2e.");
    await page.locator("#topic-scope").fill("Scope for gated e2e.");
    await page.getByRole("button", { name: /create draft topic/i }).click();
    await expect(page).toHaveURL(new RegExp(`/workspace/topics/${slug}`), {
      timeout: 30_000,
    });
    await expect(page.getByText(/draft/i).first()).toBeVisible();
    await expect(page.getByText(/not published/i).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /publish/i })).toHaveCount(0);

    await page.getByLabel(/action/i).selectOption("open");
    await page.getByRole("button", { name: /apply transition/i }).click();
    await expect(
      page.getByText(/open for submissions \(operational\)/i),
    ).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/not published/i).first()).toBeVisible();
  });

  test("non-administrator cannot open the authoring workspace", async ({
    page,
  }) => {
    await signInWithCapturedEmail(page, "ada@ostt.synth.test");
    await page.goto("/workspace/topics");
    await expect(page).not.toHaveURL(/\/workspace\/topics$/);
  });
});
