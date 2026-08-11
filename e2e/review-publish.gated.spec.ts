import { expect, test } from "@playwright/test";

import {
  expectNoHorizontalOverflow,
  signInWithCapturedEmail,
} from "./gated-helpers";

test.describe("review and publish (gated)", () => {
  test("staff admin can open review queues @desktop", async ({ page }) => {
    await signInWithCapturedEmail(page, "staff-admin@ostt.synth.test");
    await page.goto("/workspace/review");
    await expect(page.getByRole("heading", { name: "Review queues" })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByRole("heading", { name: /Claim queue/i })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Evidence queue/i }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("review queue stays usable at phone width @phone", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signInWithCapturedEmail(page, "staff-admin@ostt.synth.test");
    await page.goto("/workspace/review");
    await expect(page.getByRole("heading", { name: "Review queues" })).toBeVisible({
      timeout: 30_000,
    });
    await expectNoHorizontalOverflow(page);
  });

  test("publish control appears on workspace topic detail", async ({ page }) => {
    await signInWithCapturedEmail(page, "staff-admin@ostt.synth.test");
    await page.goto("/workspace/topics/ostt-synth-cedar-billing-ops");
    await expect(page.getByRole("heading", { name: "Publish" })).toBeVisible({
      timeout: 30_000,
    });
    await expect(
      page.getByText(/already published|Publish topic/i),
    ).toBeVisible();
  });

  test("anonymous unpublished slug is not found", async ({ page }) => {
    const response = await page.goto("/topics/does-not-exist-unpublished-slug");
    expect(response?.status()).toBe(404);
  });
});
