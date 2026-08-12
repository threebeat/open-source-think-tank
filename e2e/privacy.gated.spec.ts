import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import {
  expectNoHorizontalOverflow,
  signInWithCapturedEmail,
} from "./gated-helpers";

const SYNTHETIC_ACCOUNT = "ada@ostt.synth.test";
const OWN_ACCOUNT_ID = "account-ostt-synth-ada";
const FOREIGN_ACCOUNT_SENTINEL = "account-ostt-synth-ben";

async function expectNoSeriousAxe(page: Page, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  const serious = results.violations.filter((v) =>
    ["serious", "critical"].includes(v.impact ?? ""),
  );
  expect(serious, `${label}: ${serious.map((v) => v.id).join(", ")}`).toEqual(
    [],
  );
}

/**
 * Stateful gated privacy journey (2.12 post-merge readiness).
 * Synthetic fixtures only — no real participant data.
 */
test.describe("gated account privacy journey (synthetic)", () => {
  test("export + closure request flow, axe states, and narrow viewport", async ({
    page,
  }) => {
    await signInWithCapturedEmail(page, SYNTHETIC_ACCOUNT);

    // --- Export: own-account JSON with no-store / attachment headers ---
    const exportResponse = await page.request.get("/api/account/export");
    expect(exportResponse.status()).toBe(200);
    expect(exportResponse.headers()["cache-control"]).toBe("no-store");
    expect(exportResponse.headers()["content-disposition"]).toMatch(
      /attachment;\s*filename="ostt-account-export\.json"/i,
    );
    const exportBody = (await exportResponse.json()) as {
      ok?: boolean;
      value?: { accountId?: string };
    };
    expect(exportBody.ok).toBe(true);
    expect(exportBody.value?.accountId).toBe(OWN_ACCOUNT_ID);
    expect(JSON.stringify(exportBody)).not.toContain(FOREIGN_ACCOUNT_SENTINEL);

    await page.goto("/account/privacy");
    await expect(
      page.getByRole("heading", { name: /privacy controls/i }),
    ).toBeVisible();
    await expectNoSeriousAxe(page, "privacy initial");

    // --- Empty reason → accessible error summary focus ---
    await page.getByLabel(/reason for closure/i).fill("");
    await page.getByRole("button", { name: /submit closure request/i }).click();
    const errorSummary = page.getByRole("alert").filter({
      hasText: /closure request requires a reason/i,
    });
    await expect(errorSummary).toBeVisible();
    await expect(errorSummary).toBeFocused();
    await expectNoSeriousAxe(page, "privacy error");

    // --- Valid reason → one pending receipt; session stays active ---
    const reason =
      "Synthetic gated e2e closure request — workflow receipt only.";
    await page.getByLabel(/reason for closure/i).fill(reason);
    await page.getByRole("button", { name: /submit closure request/i }).click();
    const receipt = page.getByRole("status").filter({
      hasText: /closure request received/i,
    });
    await expect(receipt).toBeVisible();
    await expect(receipt).toContainText(/pending/i);
    await expect(receipt).toContainText(/sessions remain active/i);
    await expectNoSeriousAxe(page, "privacy receipt");

    await page.goto("/account");
    await expect(page.getByText(/\bactive\b/i).first()).toBeVisible();
    // Session cookie still authenticates — not redirected to sign-in.
    await expect(page).toHaveURL(/\/account/);

    // --- Duplicate request: stable error, no second open request ---
    await page.goto("/account/privacy");
    await page.getByLabel(/reason for closure/i).fill(
      "Synthetic duplicate closure probe.",
    );
    await page.getByRole("button", { name: /submit closure request/i }).click();
    const duplicateAlert = page.getByRole("alert").filter({
      hasText: /already exists/i,
    });
    await expect(duplicateAlert).toBeVisible();

    const duplicateApi = await page.request.post(
      "/api/account/closure-request",
      {
        data: { reason: "Synthetic API duplicate probe." },
      },
    );
    expect(duplicateApi.status()).toBe(409);
    expect(duplicateApi.headers()["cache-control"]).toBe("no-store");
    const duplicateBody = (await duplicateApi.json()) as { code?: string };
    expect(duplicateBody.code).toBe("CLOSURE_REQUEST_EXISTS");

    // --- Narrow viewport: no horizontal overflow; keyboard operable ---
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/account/privacy");
    await expect(
      page.getByRole("heading", { name: /privacy controls/i }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectNoSeriousAxe(page, "privacy mobile");

    await page.getByLabel(/reason for closure/i).focus();
    await expect(page.getByLabel(/reason for closure/i)).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("button", { name: /submit closure request/i }),
    ).toBeFocused();
  });
});
