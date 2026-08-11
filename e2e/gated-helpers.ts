import { expect, type Page } from "@playwright/test";

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
