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

test.describe("public-demo workflow practice", () => {
  test("topic recommendation practice, explorer deep links, a11y, no workspace APIs", async ({
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
        name: "Workflow practice",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: "Practice how someone would use the service",
      }),
    ).toBeVisible();
    await assertNoHorizontalOverflow(page);

    await page.getByRole("button", { name: "Recommend a topic" }).click();
    await expect(page).toHaveURL(/task=topic-recommendation/);
    await expect(
      page.getByText(/Synthetic topic-recommendation practice/i),
    ).toBeVisible();
    await expect(
      page.getByText(/Stored in this browser session only/i),
    ).toBeVisible();
    await expect(page.getByText(/Not submitted to the alpha/i)).toBeVisible();

    await page
      .getByRole("radio", { name: /School bus electrification timelines/i })
      .focus();
    await expect(
      page.getByRole("radio", {
        name: /School bus electrification timelines/i,
      }),
    ).toBeFocused();
    await page.keyboard.press("Space");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(/step=scope/);

    await page.getByRole("radio", { name: "Statewide" }).check();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(/step=details/);

    await page
      .getByRole("radio", { name: /Public cost and budget transparency/i })
      .check();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(/step=review/);
    await expect(
      page.getByText(/School bus electrification timelines/i),
    ).toBeVisible();

    await page.getByRole("button", { name: "Back / Edit" }).click();
    await expect(page).toHaveURL(/task=topic-recommendation/);
    await page
      .getByRole("radio", { name: /Rural broadband mapping accuracy/i })
      .check();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("radio", { name: "Statewide" }).check();
    await page.getByRole("button", { name: "Continue" }).click();
    await page
      .getByRole("radio", { name: /Public cost and budget transparency/i })
      .check();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(
      page.getByText(/Rural broadband mapping accuracy/i),
    ).toBeVisible();

    await page
      .getByRole("button", { name: "Submit practice recommendation" })
      .click();
    await expect(page).toHaveURL(/step=receipt/);
    await expect(
      page.getByText(/staff scoping/i),
    ).toBeVisible();
    await expect(
      page
        .getByText(/A recommendation does not automatically become a topic/i)
        .first(),
    ).toBeVisible();

    await page.reload();
    await expect(page).toHaveURL(/task=topic-recommendation/);
    await expect(page).toHaveURL(/step=receipt/);

    await page.goto("/demo/workflow?task=source-contribution&step=url");
    await page
      .getByRole("radio", { name: /Unsafe example: http scheme/i })
      .check();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByTestId("source-url-error")).toBeVisible();
    await expect(page.getByTestId("source-url-error")).toContainText(/https/i);

    await page.goto("/demo/workflow?view=moderation&state=held");
    await expect(
      page.getByTestId("workflow-moderation-state-label"),
    ).toContainText("Example held state");
    await expect(page.getByText(/You held this/i)).toHaveCount(0);

    await page.goto("/demo/workflow?task=explore&view=visitor&state=empty");
    await expect(page.getByTestId("workflow-preview-visitor")).toBeVisible();
    await expect(
      page.getByText(/No currently included claims or evidence/i),
    ).toBeVisible();
    await expect(
      page.getByText(/Metered drought surcharge reduces peak residential use/i),
    ).toHaveCount(0);

    await page.reload();
    await expect(page).toHaveURL(/view=moderation/);
    await expect(page).toHaveURL(/state=held/);

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/demo/workflow");
    await assertNoHorizontalOverflow(page);

    const accessibility = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    const serious = accessibility.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(serious).toEqual([]);

    expect(workspaceApiHits).toEqual([]);
  });
});
