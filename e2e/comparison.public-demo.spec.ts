import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("public-demo evidence comparison", () => {
  test("fixture topic page offers local comparison without gated APIs @desktop", async ({
    page,
  }) => {
    await page.goto("/formal-topics");
    const topicLink = page.locator('a[href^="/formal-topics/"]').first();
    await expect(topicLink).toBeVisible({ timeout: 30_000 });
    await topicLink.click();
    await page.getByRole("link", { name: "Evidence" }).click();
    await expect(page).toHaveURL(/section=evidence/);

    await expect(
      page.getByRole("heading", { name: /Claims and approaches/i }),
    ).toBeVisible({ timeout: 30_000 });
    await expect(
      page.getByRole("heading", { name: "Supporting evidence" }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Counterevidence" }).first(),
    ).toBeVisible();

    const compare = page.getByRole("heading", { name: "Compare two sources" });
    if (await compare.count()) {
      await expect(compare.first()).toBeVisible();
      const section = compare.first().locator("xpath=ancestor::section[1]");
      const checkboxes = section.getByRole("checkbox");
      if ((await checkboxes.count()) >= 2) {
        await checkboxes.nth(0).focus();
        await page.keyboard.press("Space");
        await checkboxes.nth(1).focus();
        await page.keyboard.press("Space");
        await expect(section.getByRole("status")).toContainText(
          /Comparing|selected/i,
        );
      }
    }

    // Must not call workspace revision APIs from public-demo.
    const revisionApiHits: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes("/api/workspace/")) {
        revisionApiHits.push(req.url());
      }
    });
    await page.reload();
    await expect(
      page.getByRole("heading", { name: /Claims and approaches/i }),
    ).toBeVisible({ timeout: 30_000 });
    expect(revisionApiHits).toEqual([]);

    const accessibility = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    const serious = accessibility.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
  });
});
