import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import {
  expectNoHorizontalOverflow,
  signInWithCapturedEmail,
} from "./gated-helpers";

const CEDAR_TOPIC_SLUG = "ostt-synth-cedar-billing-ops";
const EVIDENCE_CONFLICT_SUMMARY =
  "ostt-synth Ada discloses a fictional consulting stipend related to this evidence source.";
const PRIVATE_EVIDENCE_DETAIL =
  "Synthetic evidence private detail for staff boundary drills — never public.";
const HISTORIC_REVISION_BODY =
  "Synthetic prior summary before the recorded content revision.";

async function expectSeriousAxeClean(page: Page) {
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  const serious = accessibility.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
  expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
}

test.describe("3.10 gated public interface", () => {
  test("published topics list links to hardened detail @desktop", async ({
    page,
  }) => {
    await page.goto("/topics");
    await expect(
      page.getByRole("heading", { name: "Published topics" }),
    ).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("published-topics-list")).toBeVisible();
    await expect(
      page.getByRole("link", {
        name: /ostt-synth Cedar River billing operations gap/i,
      }),
    ).toBeVisible();

    await page
      .getByRole("link", {
        name: /ostt-synth Cedar River billing operations gap/i,
      })
      .click();
    await expect(page).toHaveURL(new RegExp(`/topics/${CEDAR_TOPIC_SLUG}`));
    await expect(
      page.getByRole("heading", { name: /How to read this publication/i }),
    ).toBeVisible({ timeout: 30_000 });
    await expectNoHorizontalOverflow(page);
    await expectSeriousAxeClean(page);
  });

  test("detail shows claim/evidence, evidence conflict, and revision summary only @desktop", async ({
    page,
  }) => {
    await page.goto(`/topics/${CEDAR_TOPIC_SLUG}`);
    await expect(
      page.getByTestId("gated-public-topic-view"),
    ).toBeVisible({ timeout: 30_000 });
    await expect(
      page.getByRole("heading", { name: "Supporting evidence" }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Counterevidence" }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Evidence conflict disclosure" }),
    ).toBeVisible();
    await expect(page.getByText(EVIDENCE_CONFLICT_SUMMARY)).toBeVisible();
    await expect(page.getByText(PRIVATE_EVIDENCE_DETAIL)).toHaveCount(0);
    await expect(page.getByText(/Revision summary:/i).first()).toBeVisible();
    await expect(page.getByText(HISTORIC_REVISION_BODY)).toHaveCount(0);
    await expect(page.locator("time[datetime]").first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("phone width has no overflow and comparison remains usable @phone", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/topics/${CEDAR_TOPIC_SLUG}`);
    await expect(
      page.getByRole("heading", { name: /Claims and evidence/i }),
    ).toBeVisible({ timeout: 30_000 });
    await expectNoHorizontalOverflow(page);
    await expectSeriousAxeClean(page);

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
  });

  test("unpublished slug remains a generic 404 @desktop", async ({ page }) => {
    const response = await page.goto("/topics/does-not-exist-unpublished-slug");
    expect(response?.status()).toBe(404);
  });

  test("pause does not unpublish a published topic @desktop", async ({
    page,
  }) => {
    await signInWithCapturedEmail(page, "staff-admin@ostt.synth.test");
    await page.goto(`/workspace/topics/${CEDAR_TOPIC_SLUG}`);
    await expect(
      page.getByText(/Publication status/i).first(),
    ).toBeVisible({ timeout: 30_000 });

    const actionSelect = page.locator("form select").first();
    if (
      (await actionSelect.count()) &&
      (await actionSelect.locator('option[value="pause"]').count())
    ) {
      page.once("dialog", (dialog) => dialog.accept());
      await actionSelect.selectOption("pause");
      await page.locator("form textarea").fill(
        "Synthetic e2e pause must not unpublish.",
      );
      await page.getByRole("button", { name: /Apply transition/i }).click();
      await expect(page.getByText(/paused/i).first()).toBeVisible({
        timeout: 30_000,
      });
    }

    await page.context().clearCookies();
    const response = await page.goto(`/topics/${CEDAR_TOPIC_SLUG}`);
    expect(response?.ok()).toBeTruthy();
    await expect(page.getByTestId("gated-public-topic-view")).toBeVisible({
      timeout: 30_000,
    });
    // Topic remains addressable after operational pause; label may already be
    // paused from this test or a prior run of the shared seed DB.
    await expect(
      page.getByRole("heading", { name: /Claims and evidence/i }),
    ).toBeVisible();
  });
});
