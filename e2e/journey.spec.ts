import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("phase 4.1 computational-democracy journey", () => {
  for (const width of [1280, 390] as const) {
    test(`separates Idea Commons from Formal Topics at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/idea-commons");
      await expect(
        page.getByRole("heading", { name: "Idea Commons", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText(/not yet in the Formal Topic Pipeline/i).first(),
      ).toBeVisible();
      await expect(page.getByRole("link", { name: /Formal Topic Pipeline/i })).toBeVisible();

      await page.goto("/formal-topics");
      await expect(
        page.getByRole("heading", { name: "Formal Topic Pipeline", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText(/No moderator, administrator, board member/i),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Three synthetic trajectories" }),
      ).toBeVisible();

      const results = await new AxeBuilder({ page }).analyze();
      const seriousOrWorse = results.violations.filter((violation) =>
        ["serious", "critical"].includes(violation.impact ?? ""),
      );
      expect(seriousOrWorse).toEqual([]);
    });
  }

  test("shows ordinary moderator proposal without privilege and deferred lineage", async ({
    page,
  }) => {
    await page.goto("/idea-commons/idea-billing-ops-proposal");
    await expect(
      page.getByText(/No elevated badge, ranking advantage, or privileged promotion/i),
    ).toBeVisible();

    await page.goto("/formal-topics/cedar-river-billing-ops-gap");
    await expect(page.getByText(/agenda_deferred/i)).toBeVisible();
    await expect(
      page.getByText(/evidence-readiness criterion is unmet/i).first(),
    ).toBeVisible();
  });

  test("aggregate report stays allowlisted and actions explain non-personalization", async ({
    page,
  }) => {
    await page.goto(
      "/formal-topics/cedar-river-drought-surcharge?view=public-input-report",
    );
    await expect(
      page.getByRole("heading", {
        name: "Anonymous aggregate Public Input report",
      }),
    ).toBeVisible();
    await expect(page.getByText(/Group A/)).toBeVisible();
    await expect(page.getByText(/provider participant IDs/i)).toBeVisible();
    await expect(page.locator("body")).not.toContainText("xid=");
    await expect(page.locator("body")).not.toContainText("perPersonVotes");

    await page.goto("/actions/cedar-river-drought-surcharge");
    await expect(
      page.getByText(/never individual Public Input votes/i).first(),
    ).toBeVisible();
    await expect(page.getByText(/Non-endorsement/i).first()).toBeVisible();
  });

  test("home primary CTA opens the guided journey", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByText(/Follow an idea from community discussion to collective action/i).first(),
    ).toBeVisible();
    await page.getByRole("link", { name: "Start the guided journey" }).click();
    await expect(page).toHaveURL(/\/demo/);
  });

  test("deep link and keyboard focus on Idea Commons practice", async ({ page }) => {
    await page.goto("/idea-commons");
    await page.getByLabel("Title").focus();
    await expect(page.getByLabel("Title")).toBeFocused();
    await page.getByLabel("Title").fill("Practice drought idea");
    await page.getByLabel("Contribution").fill("Local practice body");
    await page.getByRole("button", { name: "Save practice post" }).click();
    await expect(page.getByText("Practice drought idea")).toBeVisible();
    await expect(page).toHaveURL(/\/idea-commons$/);
  });
});
