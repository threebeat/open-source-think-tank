import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import {
  expectNoHorizontalOverflow,
  signInWithCapturedEmail,
} from "./gated-helpers";

const CEDAR_TOPIC_SLUG = "ostt-synth-cedar-billing-ops";
/** Deterministic submitted claim from synthetic foundation seed — must always exist. */
const QUEUE_CLAIM_ID = "claim-ostt-synth-billing-queue";
const QUEUE_CLAIM_PATH = `/workspace/review/claims/${QUEUE_CLAIM_ID}`;
/** Accepted claim with a seeded content revision for chronology assertions. */
const REVISION_CLAIM_ID = "claim-ostt-synth-billing-timeline";
const REVISION_CLAIM_PATH = `/workspace/review/claims/${REVISION_CLAIM_ID}`;

test.describe("revisions and evidence comparison (gated)", () => {
  test("staff claim review detail exposes revision chronology heading @desktop", async ({
    page,
  }) => {
    await signInWithCapturedEmail(page, "staff-admin@ostt.synth.test");
    await page.goto("/workspace/review");
    await expect(page.getByRole("heading", { name: "Review queues" })).toBeVisible({
      timeout: 30_000,
    });
    await expect(
      page.locator(`a[href="${QUEUE_CLAIM_PATH}"]`),
      "seeded submitted claim must appear in the review queue",
    ).toHaveCount(1);

    // Open the deterministic claim that carries seeded revision chronology.
    await page.goto(REVISION_CLAIM_PATH);
    await expect(page).toHaveURL(new RegExp(`${REVISION_CLAIM_ID}$`));
    await expect(
      page.getByRole("heading", { name: /Claim content revisions/i }),
    ).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/Revision 1/i)).toBeVisible();
    await expect(page.getByText(/Changed:\s*summary/i)).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Supporting evidence" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Counterevidence" }),
    ).toBeVisible();
    // Historic before/after bodies stay inside collapsed staff details — not openly exposed.
    await expect(
      page.getByText(
        "Synthetic prior summary before the recorded content revision.",
      ),
    ).toBeHidden();
    await expectNoHorizontalOverflow(page);
  });

  test("unauthenticated formal-topics evidence URLs redirect to sign-in (V2-21)", async ({
    page,
  }) => {
    await page.goto(`/formal-topics/${CEDAR_TOPIC_SLUG}?section=evidence`);
    await expect(page).toHaveURL(/\/auth\/sign-in/);
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

  test("authenticated formal-topics evidence URLs map to Commons", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signInWithCapturedEmail(page, "staff-admin@ostt.synth.test");
    await page.goto(`/formal-topics/${CEDAR_TOPIC_SLUG}?section=evidence`);
    await expect(page).toHaveURL(/\/commons/);
    await expect(page.getByRole("heading", { name: "Commons", exact: true })).toBeVisible();
    await expect(
      page.getByText(
        /Informal conversations may not have been reviewed by a moderator/,
      ),
    ).toBeVisible();
    await expect(
      page.getByText(/opens in a later commonhall phase/i),
    ).toHaveCount(0);
    await expect(
      page.getByText(
        "Synthetic prior summary before the recorded content revision.",
      ),
    ).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
  });
});
