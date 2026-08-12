import { expect, type Page } from "@playwright/test";

/** Synthetic staff admin account id from foundation seed (assign/approve only). */
export const SYNTHETIC_STAFF_ADMIN_ACCOUNT_ID =
  "account-ostt-synth-staff-admin";

/** Document must not require horizontal scrolling at the current viewport. */
export async function expectNoHorizontalOverflow(page: Page) {
  const overflowed = await page.evaluate(() => {
    const root = document.documentElement;
    return root.scrollWidth > root.clientWidth + 1;
  });
  expect(overflowed, "expected no horizontal document overflow").toBe(false);
}

export async function completeInviteSession(
  page: Page,
  inviteToken: string,
  contactChannel: string,
) {
  const accept = await page.request.post("/api/auth/accept-invite", {
    data: { inviteToken, contactChannel },
  });
  expect(accept.ok(), await accept.text()).toBeTruthy();

  const capture = await page.request.get("/api/test/last-email");
  expect(capture.ok()).toBeTruthy();
  const mail = (await capture.json()) as { textBody?: string };
  const tokenMatch = mail.textBody!.match(/token=([^&\s]+)/);
  expect(tokenMatch?.[1]).toBeTruthy();
  const token = decodeURIComponent(tokenMatch![1]!);
  await page.goto(`/auth/complete?token=${encodeURIComponent(token)}`);
  await expect(page).toHaveURL(/\/account/, { timeout: 30_000 });
}

export async function signInWithCapturedEmail(
  page: Page,
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
 * Activate a seed participant (Ada) through the real verification + onboarding
 * APIs so conflicts.disclose_own is available. Idempotent when already active.
 * Leaves the browser signed in as the participant.
 */
export async function activateSyntheticParticipant(
  page: Page,
  contactChannel: string,
) {
  await page.context().clearCookies();
  await signInWithCapturedEmail(page, contactChannel);

  const activateProbe = await page.request.post("/api/onboarding/activate");
  if (activateProbe.ok()) {
    await page.context().clearCookies();
    await signInWithCapturedEmail(page, contactChannel);
    return;
  }
  const probeBody = (await activateProbe.json()) as { code?: string };
  if (probeBody.code === "ONBOARD_ALREADY_ACTIVE") {
    await page.context().clearCookies();
    await signInWithCapturedEmail(page, contactChannel);
    return;
  }

  const kinds = ["bot_resistance", "uniqueness", "eligibility"] as const;
  const caseIds: string[] = [];
  for (const kind of kinds) {
    const opened = await page.request.post("/api/verification/open", {
      data: {
        kind,
        assertionSummary: `Synthetic ${kind} assertion for gated e2e activation.`,
      },
    });
    if (!opened.ok()) {
      // Kind may already be approved/pending from a prior suite step.
      continue;
    }
    const body = (await opened.json()) as { caseId?: string };
    expect(body.caseId).toBeTruthy();
    caseIds.push(body.caseId!);
  }

  if (caseIds.length > 0) {
    await page.context().clearCookies();
    await signInWithCapturedEmail(page, "staff-admin@ostt.synth.test");
    for (const caseId of caseIds) {
      const assign = await page.request.post("/api/verification/review", {
        data: {
          action: "assign",
          caseId,
          reviewerAccountId: SYNTHETIC_STAFF_ADMIN_ACCOUNT_ID,
        },
      });
      expect(assign.ok(), await assign.text()).toBeTruthy();
      const approve = await page.request.post("/api/verification/review", {
        data: {
          action: "approve",
          caseId,
          reason: "Synthetic staff approval for gated e2e activation.",
        },
      });
      expect(approve.ok(), await approve.text()).toBeTruthy();
    }
  }

  await page.context().clearCookies();
  await signInWithCapturedEmail(page, contactChannel);
  const activated = await page.request.post("/api/onboarding/activate");
  if (!activated.ok()) {
    const body = (await activated.json()) as { code?: string; error?: string };
    expect(
      body.code,
      `expected activation success or already-active; got ${JSON.stringify(body)}`,
    ).toBe("ONBOARD_ALREADY_ACTIVE");
  }
  await page.context().clearCookies();
  await signInWithCapturedEmail(page, contactChannel);
}
