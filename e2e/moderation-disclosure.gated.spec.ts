import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import {
  activateSyntheticParticipant,
  expectNoHorizontalOverflow,
  signInWithCapturedEmail,
} from "./gated-helpers";

const ADA = "ada@ostt.synth.test";
const MODERATOR = "staff-moderator@ostt.synth.test";
const BILLING_CLAIM_ID = "claim-ostt-synth-billing-timeline";
const DRILL_CLAIM_ID = "claim-ostt-synth-moderation-drill";
const BILLING_MEMO_EVIDENCE_ID = "evsub-ostt-synth-billing-memo";
const CEDAR_TOPIC_SLUG = "ostt-synth-cedar-billing-ops";
const PRIVATE_DETAIL =
  "Synthetic private detail for staff-only drill — must not appear in public projections.";
const PUBLIC_SUMMARY =
  "ostt-synth Ada discloses a fictional prior volunteer role with a billing advisory group.";

async function expectSeriousAxeClean(page: Page) {
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  const serious = accessibility.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
  expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
}

test.describe.configure({ mode: "serial" });

test.describe("moderation and disclosure (gated)", () => {
  test("owner can update own claim disclosure public summary @desktop", async ({
    page,
  }) => {
    await activateSyntheticParticipant(page, ADA);
    await page.goto(`/workspace/submissions/${BILLING_CLAIM_ID}`);
    const disclosureSection = page.locator(
      "section[aria-labelledby='claim-disclosure-heading']",
    );
    await expect(
      disclosureSection.getByRole("heading", {
        name: "Claim conflict disclosure",
      }),
    ).toBeVisible({ timeout: 30_000 });
    const currentCard = disclosureSection.locator(
      "section[aria-labelledby='conflict-disclosure-card-heading']",
    );
    await expect(
      currentCard.getByText(PUBLIC_SUMMARY, { exact: true }),
    ).toBeVisible();

    const updatedSummary =
      "ostt-synth Ada updated public conflict summary for billing timeline e2e.";
    const form = disclosureSection.locator("form").first();
    await form.getByLabel(/Public conflict summary/i).fill(updatedSummary);
    await form
      .getByRole("button", { name: /Save conflict disclosure/i })
      .click();

    await expect(disclosureSection.getByRole("alert")).toHaveCount(0, {
      timeout: 15_000,
    });
    await expect(
      currentCard.getByText(updatedSummary, { exact: true }),
    ).toBeVisible({ timeout: 30_000 });
    await expectNoHorizontalOverflow(page);
  });

  test("moderator sees public disclosure summary but not private detail @desktop", async ({
    page,
  }) => {
    await page.context().clearCookies();
    await signInWithCapturedEmail(page, MODERATOR);
    await page.goto(`/workspace/moderation/claims/${BILLING_CLAIM_ID}`);
    const card = page.locator(
      "section[aria-labelledby='conflict-disclosure-card-heading']",
    );
    await expect(
      card.getByRole("heading", { name: /Conflict disclosure on this claim/i }),
    ).toBeVisible({ timeout: 30_000 });
    await expect(card.getByText(/Public summary/i)).toBeVisible();
    // May show the original or the owner-updated summary from the prior test.
    await expect(card.getByText(/ostt-synth Ada/i)).toBeVisible();
    await expect(page.getByText(PRIVATE_DETAIL)).toHaveCount(0);
    await expect(card.getByText(/Private detail \(not public\)/i)).toHaveCount(
      0,
    );
  });

  test("moderator hold → hide → restore drill claim at phone width @phone", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.context().clearCookies();
    await signInWithCapturedEmail(page, MODERATOR);

    async function openDrillClaim() {
      await page.goto(`/workspace/moderation/claims/${DRILL_CLAIM_ID}`);
      await expect(
        page.getByRole("heading", {
          name: /ostt-synth Moderation drill claim/i,
        }),
      ).toBeVisible({ timeout: 30_000 });
    }

    async function recordAction(actionLabel: RegExp, rationale: string) {
      const actionSection = page.locator(
        "section[aria-labelledby='moderation-action-heading']",
      );
      await expect(
        actionSection.getByRole("heading", {
          name: /Record visibility action/i,
        }),
      ).toBeVisible();
      await actionSection.getByLabel(actionLabel).check();
      await actionSection.getByLabel(/Public rationale/i).fill(rationale);
      await actionSection
        .getByRole("button", { name: /Record moderation action/i })
        .click();
      await expect(page).toHaveURL(/\/workspace\/moderation$/, {
        timeout: 30_000,
      });
    }

    const visibilityValue = () =>
      page.locator("dt", { hasText: "Current visibility" }).locator("+ dd");

    await openDrillClaim();
    await expect(visibilityValue()).toHaveText(/^visible$/i);
    await recordAction(
      /Hold \(temporarily withhold\)/i,
      "Synthetic e2e hold rationale for moderation drill claim.",
    );

    const heldRegion = page.locator(
      "section[aria-labelledby='held-hidden-heading']",
    );
    await expect(
      heldRegion.getByRole("link", {
        name: /ostt-synth Moderation drill claim/i,
      }),
    ).toBeVisible({ timeout: 30_000 });
    await expect(heldRegion.getByText(/\bheld\b/i).first()).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await openDrillClaim();
    await expect(visibilityValue()).toHaveText(/^held$/i);
    await recordAction(
      /Hide from public projection/i,
      "Synthetic e2e hide rationale for moderation drill claim.",
    );
    await expect(
      heldRegion.getByRole("link", {
        name: /ostt-synth Moderation drill claim/i,
      }),
    ).toBeVisible({ timeout: 30_000 });
    await expect(heldRegion.getByText(/\bhidden\b/i).first()).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await openDrillClaim();
    await expect(visibilityValue()).toHaveText(/^hidden$/i);
    await recordAction(
      /Restore to visible/i,
      "Synthetic e2e restore rationale for moderation drill claim.",
    );
    const visibleRegion = page.locator(
      "section[aria-labelledby='visible-heading']",
    );
    await expect(
      visibleRegion.getByRole("link", {
        name: /ostt-synth Moderation drill claim/i,
      }),
    ).toBeVisible({ timeout: 30_000 });
    await expectNoHorizontalOverflow(page);
  });

  test("participant cannot open moderation queue", async ({ page }) => {
    await page.context().clearCookies();
    await signInWithCapturedEmail(page, ADA);
    await page.goto("/workspace/moderation");
    await expect(page).not.toHaveURL(/\/workspace\/moderation$/, {
      timeout: 30_000,
    });
    await expect(
      page.getByRole("heading", { name: "Moderation queue" }),
    ).toHaveCount(0);
  });

  test("holding projected evidence shows public withheld notice without private notes @desktop", async ({
    page,
  }) => {
    await page.context().clearCookies();
    await signInWithCapturedEmail(page, MODERATOR);
    await page.goto(
      `/workspace/moderation/evidence/${BILLING_MEMO_EVIDENCE_ID}`,
    );
    const actionSection = page.locator(
      "section[aria-labelledby='moderation-action-heading']",
    );
    await expect(
      actionSection.getByRole("heading", { name: /Record visibility action/i }),
    ).toBeVisible({ timeout: 30_000 });
    const holdRationale =
      "Synthetic e2e evidence hold for public withheld-notice drill.";
    await actionSection.getByLabel(/Hold \(temporarily withhold\)/i).check();
    await actionSection.getByLabel(/Public rationale/i).fill(holdRationale);
    await actionSection
      .getByRole("button", { name: /Record moderation action/i })
      .click();
    await expect(page).toHaveURL(/\/workspace\/moderation$/, {
      timeout: 30_000,
    });

    await page.context().clearCookies();
    const response = await page.goto(`/topics/${CEDAR_TOPIC_SLUG}`);
    expect(response?.ok()).toBeTruthy();
    await expect(
      page.getByRole("heading", { name: /Claims and evidence/i }),
    ).toBeVisible({ timeout: 30_000 });

    const withheld = page.locator(
      "section[aria-labelledby='withheld-moderation-heading']",
    );
    await expect(
      withheld.getByRole("heading", {
        name: /Withheld from this publication/i,
      }),
    ).toBeVisible();
    await expect(withheld.getByText(holdRationale)).toBeVisible();
    await expect(
      withheld.getByText(/Evidence temporarily withheld/i),
    ).toBeVisible();

    // Held evidence body/title must not leak; private notes never public.
    await expect(
      page.getByText("ostt-synth Billing operations memo", { exact: false }),
    ).toHaveCount(0);
    await expect(
      page.getByText(/Synthetic private evidence note/i),
    ).toHaveCount(0);
    await expect(page.getByText(PRIVATE_DETAIL)).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
  });

  test("moderation form fields are keyboard-focusable @desktop", async ({
    page,
  }) => {
    await page.context().clearCookies();
    await signInWithCapturedEmail(page, MODERATOR);
    // Drill claim was restored to visible; form should offer hold/hide.
    await page.goto(`/workspace/moderation/claims/${DRILL_CLAIM_ID}`);
    const actionSection = page.locator(
      "section[aria-labelledby='moderation-action-heading']",
    );
    await expect(
      actionSection.getByRole("heading", { name: /Record visibility action/i }),
    ).toBeVisible({ timeout: 30_000 });

    const holdRadio = actionSection.getByLabel(
      /Hold \(temporarily withhold\)/i,
    );
    await holdRadio.focus();
    await expect(holdRadio).toBeFocused();
    await page.keyboard.press("Tab");
    const hideRadio = actionSection.getByLabel(/Hide from public projection/i);
    await expect(hideRadio).toBeFocused();
    await page.keyboard.press("Tab");
    const rationale = actionSection.getByLabel(/Public rationale/i);
    await expect(rationale).toBeFocused();
    await page.keyboard.press("Tab");
    const privateNotes = actionSection.getByLabel(/Private moderator notes/i);
    await expect(privateNotes).toBeFocused();
    await page.keyboard.press("Tab");
    const submit = actionSection.getByRole("button", {
      name: /Record moderation action/i,
    });
    await expect(submit).toBeFocused();
  });

  test("axe clean on moderation queue and disclosure form @desktop", async ({
    page,
  }) => {
    await page.context().clearCookies();
    await signInWithCapturedEmail(page, MODERATOR);
    await page.goto("/workspace/moderation");
    await expect(
      page.getByRole("heading", { name: "Moderation queue" }),
    ).toBeVisible({ timeout: 30_000 });
    await expectSeriousAxeClean(page);

    await page.context().clearCookies();
    await signInWithCapturedEmail(page, ADA);
    await page.goto(`/workspace/submissions/${BILLING_CLAIM_ID}`);
    await expect(
      page.getByRole("heading", { name: "Claim conflict disclosure" }),
    ).toBeVisible({ timeout: 30_000 });
    await expectSeriousAxeClean(page);
  });
});
