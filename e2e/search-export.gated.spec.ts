import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import {
  activateSyntheticParticipant,
  expectNoHorizontalOverflow,
  signInWithCapturedEmail,
} from "./gated-helpers";

const ADA = "ada@ostt.synth.test";
const STAFF_ADMIN = "staff-admin@ostt.synth.test";
const OWN_ACCOUNT_ID = "account-ostt-synth-ada";
const FOREIGN_ACCOUNT_SENTINEL = "account-ostt-synth-ben";
const CEDAR_TOPIC_ID = "topic-ostt-synth-cedar-billing";
const OWN_CLAIM_TITLE =
  "ostt-synth Clearer billing timeline reduces call volume";
const FOREIGN_DRAFT_MARKER = "zz-ostt-foreign-private-draft-never-present";

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

test.describe.configure({ mode: "serial" });

/**
 * Keep auth attempts low — gated auth rate limits are in-process and shared
 * across the serial suite.
 */
test.describe("workspace search and export (gated)", () => {
  test("participant search, ACL absence, export, a11y", async ({ page }) => {
    await activateSyntheticParticipant(page, ADA);

    await page.goto("/workspace/search?q=billing&entities=claims");
    await expect(
      page.getByRole("heading", { name: /^Search$/i }),
    ).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(OWN_CLAIM_TITLE)).toBeVisible({
      timeout: 30_000,
    });
    await page.getByRole("link", { name: OWN_CLAIM_TITLE }).click();
    await expect(page).toHaveURL(/\/workspace\/submissions\//, {
      timeout: 30_000,
    });

    await page.goto(
      `/workspace/search?q=${encodeURIComponent(FOREIGN_DRAFT_MARKER)}&entities=claims`,
    );
    await expect(
      page.getByRole("heading", { name: /^Search$/i }),
    ).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/No matches/i)).toBeVisible();
    await expect(
      page.getByRole("link", { name: FOREIGN_DRAFT_MARKER }),
    ).toHaveCount(0);

    const exportResponse = await page.request.get("/api/account/export");
    expect(exportResponse.status()).toBe(200);
    expect(exportResponse.headers()["cache-control"]).toBe("no-store");
    expect(exportResponse.headers()["x-content-type-options"]).toBe("nosniff");
    const exportBody = (await exportResponse.json()) as {
      ok?: boolean;
      value?: {
        accountId?: string;
        workspace?: { claims?: unknown[] };
      };
    };
    expect(exportBody.ok).toBe(true);
    expect(exportBody.value?.accountId).toBe(OWN_ACCOUNT_ID);
    expect(exportBody.value?.workspace).toBeTruthy();
    expect(exportBody.value?.workspace?.claims?.length ?? 0).toBeGreaterThan(0);
    expect(JSON.stringify(exportBody)).not.toContain(FOREIGN_ACCOUNT_SENTINEL);

    const denied = await page.request.get(
      `/api/workspace/topics/${CEDAR_TOPIC_ID}/export`,
    );
    expect(denied.status()).toBe(404);
    expect(denied.headers()["cache-control"]).toBe("no-store");
    const deniedBody = (await denied.json()) as { code?: string };
    expect(deniedBody.code).toBe("TOPIC_NOT_FOUND");

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/workspace/search?q=billing&entities=claims,topics");
    await expect(
      page.getByRole("heading", { name: /^Search$/i }),
    ).toBeVisible({ timeout: 30_000 });
    await expectNoSeriousAxe(page, "workspace search desktop");
    await expectNoHorizontalOverflow(page);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await expect(
      page.getByRole("heading", { name: /^Search$/i }),
    ).toBeVisible({ timeout: 30_000 });
    await expectNoSeriousAxe(page, "workspace search mobile");
    await expectNoHorizontalOverflow(page);
  });

  test("staff search and topic export", async ({ page }) => {
    await page.context().clearCookies();
    await signInWithCapturedEmail(page, STAFF_ADMIN);

    await page.goto(
      "/workspace/search?q=Queue-only+billing&entities=claims",
    );
    await expect(
      page.getByRole("heading", { name: /^Search$/i }),
    ).toBeVisible({ timeout: 30_000 });
    await expect(
      page.getByText(/ostt-synth Queue-only billing follow-up claim/i),
    ).toBeVisible({ timeout: 30_000 });

    await page.goto("/workspace/topics/ostt-synth-cedar-billing-ops");
    await expect(
      page.getByRole("heading", { name: /Staff export/i }),
    ).toBeVisible({ timeout: 30_000 });
    await expect(
      page.getByRole("button", { name: /Download staff topic export/i }),
    ).toBeVisible();

    const staffExport = await page.request.get(
      `/api/workspace/topics/${CEDAR_TOPIC_ID}/export`,
    );
    expect(staffExport.status()).toBe(200);
    expect(staffExport.headers()["cache-control"]).toBe("no-store");
    expect(staffExport.headers()["x-content-type-options"]).toBe("nosniff");
    expect(staffExport.headers()["content-disposition"]).toMatch(
      /attachment;\s*filename="ostt-topic-export-ostt-synth-cedar-billing-ops\.json"/i,
    );
    const staffBody = (await staffExport.json()) as {
      ok?: boolean;
      value?: { topic?: { id?: string } };
    };
    expect(staffBody.ok).toBe(true);
    expect(staffBody.value?.topic?.id).toBe(CEDAR_TOPIC_ID);
    expect(JSON.stringify(staffBody)).not.toContain(FOREIGN_ACCOUNT_SENTINEL);
    expect(JSON.stringify(staffBody)).not.toContain(OWN_ACCOUNT_ID);
    expect(JSON.stringify(staffBody)).not.toContain("privateNotes");
  });
});
