import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const base = "http://127.0.0.1:3000";

async function signIn(page, contact) {
  await page.request.post(`${base}/api/auth/request-sign-in`, {
    data: { contactChannel: contact },
  });
  const capture = await page.request.get(`${base}/api/test/last-email`);
  const mail = await capture.json();
  const match = mail.textBody.match(/token=([^&\s]+)/);
  const token = decodeURIComponent(match[1]);
  await page.goto(`${base}/auth/complete?token=${encodeURIComponent(token)}`);
  await page.waitForURL(/\/account/);
}

async function main() {
  await mkdir("tmp-qa", { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.setViewportSize({ width: 1280, height: 800 });
  await signIn(page, "ada@ostt.synth.test");
  await page.request.post(`${base}/api/onboarding/activate`).catch(() => {});
  await page.context().clearCookies();
  await signIn(page, "ada@ostt.synth.test");
  await page.goto(`${base}/workspace/search?q=billing&entities=claims,topics`);
  await page.waitForTimeout(800);
  await page.screenshot({
    path: "tmp-qa/desktop-search-participant.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await page.waitForTimeout(500);
  await page.screenshot({
    path: "tmp-qa/phone-search-participant.png",
    fullPage: true,
  });

  await page.context().clearCookies();
  await page.setViewportSize({ width: 1280, height: 800 });
  await signIn(page, "staff-admin@ostt.synth.test");
  await page.goto(
    `${base}/workspace/search?q=Queue-only+billing&entities=claims`,
  );
  await page.waitForTimeout(800);
  await page.screenshot({
    path: "tmp-qa/desktop-search-staff.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await page.waitForTimeout(500);
  await page.screenshot({
    path: "tmp-qa/phone-search-staff.png",
    fullPage: true,
  });

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`${base}/workspace/topics/ostt-synth-cedar-billing-ops`);
  await page.waitForTimeout(800);
  await page.screenshot({
    path: "tmp-qa/desktop-export-controls.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await page.waitForTimeout(500);
  await page.screenshot({
    path: "tmp-qa/phone-export-controls.png",
    fullPage: true,
  });

  await browser.close();
  console.log("screenshots ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
