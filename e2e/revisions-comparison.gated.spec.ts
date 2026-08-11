import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import {
  expectNoHorizontalOverflow,
  signInWithCapturedEmail,
} from "./gated-helpers";

test.describe("revisions and evidence comparison (gated)", () => {
  test("published topic groups supporting/counterevidence and stays overflow-free @desktop", async ({
    page,
  }) => {
    await page.goto("/topics/ostt-synth-cedar-billing-ops");
    await expect(
      page.getByRole("heading", { name: /Claims and evidence/i }),
    ).toBeVisible({ timeout: 30_000 });
    await expect(
      page.getByRole("heading", { name: "Supporting evidence" }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Counterevidence" }).first(),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);

    const accessibility = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    const serious = accessibility.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
  });

  test("published topic comparison works at phone width when two sources exist @phone", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/topics/ostt-synth-cedar-billing-ops");
    await expect(
      page.getByRole("heading", { name: /Claims and evidence/i }),
    ).toBeVisible({ timeout: 30_000 });
    const compareHeading = page.getByRole("heading", {
      name: "Compare two sources",
    });
    if (await compareHeading.count()) {
      await expect(compareHeading.first()).toBeVisible();
      const checkboxes = page.getByRole("checkbox");
      const count = await checkboxes.count();
      if (count >= 2) {
        await checkboxes.nth(0).check();
        await checkboxes.nth(1).check();
        await expect(page.getByRole("status").first()).toContainText(
          /Comparing/i,
        );
        await page.getByRole("button", { name: /Clear comparison/i }).click();
        await expect(page.getByRole("status").first()).toContainText(
          /No sources selected/i,
        );
      }
    }
    await expectNoHorizontalOverflow(page);
  });

  test("staff claim review detail exposes revision chronology heading @desktop", async ({
    page,
  }) => {
    await signInWithCapturedEmail(page, "staff-admin@ostt.synth.test");
    await page.goto("/workspace/review");
    await expect(page.getByRole("heading", { name: "Review queues" })).toBeVisible({
      timeout: 30_000,
    });
    const claimLink = page.locator('a[href*="/workspace/review/claims/"]').first();
    if ((await claimLink.count()) === 0) {
      test.skip(true, "No claim queue items in seed");
      return;
    }
    await claimLink.click();
    await expect(
      page.getByRole("heading", { name: /Claim content revisions/i }),
    ).toBeVisible({ timeout: 30_000 });
    await expect(
      page.getByRole("heading", { name: "Supporting evidence" }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});
