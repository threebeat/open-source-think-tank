import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { expectNoHorizontalOverflow } from "./gated-helpers";

test.describe("gated Commons member posts", () => {
  test("member creates a general discussion and sees it after reload", async ({
    page,
  }) => {
    const identifier = `commons-${Date.now()}@ostt.synth.test`;
    const password = "a-sufficiently-long-pass";
    const title = `Flood markers ${Date.now()}`;

    await page.goto("/join");
    await page.getByLabel(/identifier/i).fill(identifier);
    await page.getByLabel(/password/i).fill(password);
    await page.getByRole("checkbox").check();
    await page.waitForTimeout(1600);
    await page.getByRole("button", { name: /create account/i }).click();
    await expect(page).toHaveURL(/\/account/, { timeout: 30_000 });

    await page.goto("/commons");
    await expect(page.getByRole("heading", { name: "Commons", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Formal Commons" })).toBeVisible();
    await expect(
      page.getByText(
        /Informal conversations may not have been reviewed by a moderator/,
      ),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Informal Commons" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Create a post" })).toBeVisible();

    await page.getByLabel(/^category$/i).selectOption("general_discussion");
    await page.getByLabel(/^title$/i).fill(title);
    await page.getByLabel(/^body$/i).fill(
      "Should the hall map high-water marks on the river path?",
    );
    await page.getByRole("button", { name: /^create post$/i }).click();
    await expect(page.getByRole("heading", { name: title })).toBeVisible({
      timeout: 15_000,
    });

    await page.goto("/commons");
    await expect(page.getByRole("link", { name: title })).toBeVisible();

    const axe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    const serious = axe.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact ?? ""),
    );
    expect(serious, serious.map((v) => v.id).join(", ")).toEqual([]);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await expect(page.getByRole("heading", { name: "Commons", exact: true })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});
