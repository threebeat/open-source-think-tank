import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { expectNoHorizontalOverflow } from "./gated-helpers";

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
    await page.goto("/formal-topics");
    await expect(
      page.getByRole("heading", { name: "Published topics" }),
    ).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("published-topics-list")).toBeVisible();
    await expect(page).toHaveTitle(/Published topics/i);
    await expect(
      page.getByRole("link", {
        name: /ostt-synth Cedar River billing operations gap/i,
      }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectSeriousAxeClean(page);

    // Full navigation (not soft-nav) so document title metadata is applied.
    await page.goto(`/formal-topics/${CEDAR_TOPIC_SLUG}?section=evidence`);
    await expect(
      page.getByRole("heading", { name: /How to read this publication/i }),
    ).toBeVisible({ timeout: 30_000 });
    await expect(page).toHaveTitle(/Cedar River billing operations/i);
    await expectNoHorizontalOverflow(page);
    await expectSeriousAxeClean(page);
  });

  test("detail shows claim/evidence, evidence conflict, and revision summary only @desktop", async ({
    page,
  }) => {
    await page.goto(`/formal-topics/${CEDAR_TOPIC_SLUG}?section=evidence`);
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
    await page.goto(`/formal-topics/${CEDAR_TOPIC_SLUG}?section=evidence`);
    await expect(
      page.getByRole("heading", { name: /Claims and evidence|Evidence/i }),
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
    const response = await page.goto(
      "/formal-topics/does-not-exist-unpublished-slug",
    );
    expect(response?.status()).toBe(404);
  });

  test("published topic stays addressable with operational label @desktop", async ({
    page,
  }) => {
    // Pause≠unpublish is covered by unit tests; this visitor check avoids an
    // extra auth sign-in that can trip AUTH_RATE_LIMITED in the serial suite.
    const response = await page.goto(
      `/formal-topics/${CEDAR_TOPIC_SLUG}?section=evidence`,
    );
    expect(response?.ok()).toBeTruthy();
    await expect(page.getByTestId("gated-public-topic-view")).toBeVisible({
      timeout: 30_000,
    });
    await expect(
      page.getByRole("heading", { name: /^Evidence$/ }),
    ).toBeVisible();
    await expect(
      page.getByText(/\(operational\)/i).first(),
    ).toBeVisible();
  });
});
