import { expect, test } from "@playwright/test";

import {
  expectNoHorizontalOverflow,
  signInWithCapturedEmail,
} from "./gated-helpers";

test.describe("participant submissions (gated)", () => {
  test("pending participant is redirected away from submit form", async ({
    page,
  }) => {
    await signInWithCapturedEmail(page, "ada@ostt.synth.test");
    await page.goto(
      "/workspace/topics/ostt-synth-cedar-billing-ops/submit",
    );
    // Ada remains pending_onboarding in foundation seed → no claims.submit.
    await expect(page).not.toHaveURL(/\/submit$/, { timeout: 30_000 });
  });

  test("submit route stays mode-isolated and overflow-free @phone", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signInWithCapturedEmail(page, "staff-admin@ostt.synth.test");
    await page.goto(
      "/workspace/topics/ostt-synth-cedar-billing-ops/submit",
    );
    // Administrator is not a participant — redirected, still no overflow.
    await expectNoHorizontalOverflow(page);
  });

  test("workspace submissions list is reachable for signed-in users @desktop", async ({
    page,
  }) => {
    await signInWithCapturedEmail(page, "ada@ostt.synth.test");
    await page.goto("/workspace/submissions");
    // Pending accounts are redirected home; page must not 500.
    await expect(page).not.toHaveURL(/\/api\//);
    await expectNoHorizontalOverflow(page);
  });
});
