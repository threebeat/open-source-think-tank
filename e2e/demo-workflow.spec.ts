import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function assertNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return {
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
    };
  });
  expect(
    overflow.scrollWidth,
    `horizontal overflow at ${overflow.scrollWidth}px > ${overflow.clientWidth}px`,
  ).toBeLessThanOrEqual(overflow.clientWidth + 1);
}

test.describe("public-demo operational workflow preview", () => {
  test("deep links, refresh, keyboard selector, a11y, and no workspace APIs", async ({
    page,
  }) => {
    const workspaceApiHits: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes("/api/workspace/")) {
        workspaceApiHits.push(req.url());
      }
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/demo/workflow");
    await expect(
      page.getByRole("heading", {
        name: "Operational workflow preview",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Synthetic preview" }),
    ).toBeVisible();
    await expect(
      page.getByText(/Synthetic role preview — participant submission/i),
    ).toBeVisible();
    await assertNoHorizontalOverflow(page);

    await page.goto("/demo/workflow?view=moderation&state=held");
    await expect(
      page.getByTestId("workflow-moderation-state-label"),
    ).toContainText("Example held state");
    await expect(
      page.getByText(/Preview next state: hidden/i),
    ).toBeVisible();
    await expect(page.getByText(/You held this/i)).toHaveCount(0);
    await expect(page.getByText(/Action completed/i)).toHaveCount(0);

    await page.reload();
    await expect(page).toHaveURL(/view=moderation/);
    await expect(page).toHaveURL(/state=held/);
    await expect(
      page.getByTestId("workflow-moderation-state-label"),
    ).toContainText("Example held state");

    await page.goto("/demo/workflow?view=visitor");
    await expect(
      page.getByTestId("workflow-preview-visitor"),
    ).toContainText(/Synthetic role preview — visitor public projection/i);
    await expect(
      page.getByTestId("workflow-visitor-state-label"),
    ).toContainText(/Visitor view while claim is visible/i);

    const viewSelect = page.getByLabel("Synthetic preview view");
    await viewSelect.focus();
    await expect(viewSelect).toBeFocused();
    await viewSelect.selectOption("revision");
    await expect(page).toHaveURL(/view=revision/);
    await expect(
      page.getByText(/Synthetic role preview — revision chronology/i),
    ).toBeVisible();

    await assertNoHorizontalOverflow(page);

    const accessibility = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    const serious = accessibility.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);

    expect(workspaceApiHits).toEqual([]);
  });
});
