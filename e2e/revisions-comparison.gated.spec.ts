import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import {
  expectNoHorizontalOverflow,
  signInWithCapturedEmail,
} from "./gated-helpers";

const CEDAR_TOPIC_SLUG = "ostt-synth-cedar-billing-ops";

test.describe("revisions and evidence comparison (gated)", () => {
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

  test("published topic groups supporting/counterevidence with summary-only revisions @desktop", async ({
    page,
  }) => {
    await page.goto(`/topics/${CEDAR_TOPIC_SLUG}`);
    await expect(
      page.getByRole("heading", { name: /Claims and evidence/i }),
    ).toBeVisible({ timeout: 30_000 });
    await expect(
      page.getByRole("heading", { name: "Supporting evidence" }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Counterevidence" }).first(),
    ).toBeVisible();
    await expect(
      page.getByText(/ostt-synth Billing operations memo/i).first(),
    ).toBeVisible();
    await expect(
      page.getByText(/ostt-synth Billing operations counter brief/i).first(),
    ).toBeVisible();

    // Summary-only revision notice — never historic bodies from seed revision.
    await expect(page.getByText(/Revision summary:/i).first()).toBeVisible();
    await expect(page.getByText(/summary updated/i).first()).toBeVisible();
    await expect(
      page.getByText(
        "Synthetic prior summary before the recorded content revision.",
      ),
    ).toHaveCount(0);

    await expectNoHorizontalOverflow(page);

    const accessibility = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    const serious = accessibility.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
  });

  test("published topic comparison works at phone width with two sources @phone", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/topics/${CEDAR_TOPIC_SLUG}`);
    await expect(
      page.getByRole("heading", { name: /Claims and evidence/i }),
    ).toBeVisible({ timeout: 30_000 });

    const compareHeading = page.getByRole("heading", {
      name: "Compare two sources",
    });
    await expect(compareHeading.first()).toBeVisible();
    const section = compareHeading.first().locator("xpath=ancestor::section[1]");
    const checkboxes = section.getByRole("checkbox");
    await expect(checkboxes).toHaveCount(2);

    await checkboxes.nth(0).focus();
    await page.keyboard.press("Space");
    await checkboxes.nth(1).focus();
    await page.keyboard.press("Space");
    await expect(section.getByRole("status")).toContainText(/Comparing/i);
    await section.getByRole("button", { name: /Clear comparison/i }).click();
    await expect(section.getByRole("status")).toContainText(
      /No sources selected/i,
    );
    await expectNoHorizontalOverflow(page);
  });
});
