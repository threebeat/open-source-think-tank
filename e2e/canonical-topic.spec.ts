import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("canonical formal topic page", () => {
  for (const width of [1280, 390] as const) {
    test(`overview/evidence/discussions IA at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/formal-topics/cedar-river-drought-surcharge");

      await expect(
        page.getByRole("heading", {
          name: "Cedar River residential drought surcharge",
          exact: true,
        }),
      ).toBeVisible();
      await expect(page.getByText("cedar-river-drought-surcharge")).toHaveCount(0);

      const overview = page.getByRole("link", { name: "Overview", exact: true });
      const evidence = page.getByRole("link", { name: "Evidence", exact: true });
      const discussions = page.getByRole("link", {
        name: "Discussions & Proposals",
        exact: true,
      });
      await expect(overview).toBeVisible();
      await expect(evidence).toBeVisible();
      await expect(discussions).toBeVisible();
      await expect(overview).toHaveAttribute("aria-current", "page");

      await expect(
        page.getByRole("heading", { name: "What this topic needs next" }),
      ).toBeVisible();
      await expect(page.getByText("Explore evidence")).toBeVisible();
      await expect(page.getByTestId("opinion-group-suppressed")).toContainText(
        "Suppressed",
      );
      await expect(page.getByRole("heading", { name: "Claims and approaches" })).toHaveCount(
        0,
      );

      await evidence.click();
      await expect(page).toHaveURL(/section=evidence/);
      await expect(evidence).toHaveAttribute("aria-current", "page");
      await expect(
        page.getByRole("heading", { name: "Claims and approaches" }),
      ).toBeVisible();

      await discussions.click();
      await expect(page).toHaveURL(/section=discussions/);
      await expect(discussions).toHaveAttribute("aria-current", "page");
      await expect(
        page.getByText(/Idea Commons remains informal/i),
      ).toBeVisible();

      await page.goBack();
      await expect(page).toHaveURL(/section=evidence/);
      await page.goForward();
      await expect(page).toHaveURL(/section=discussions/);

      const results = await new AxeBuilder({ page }).analyze();
      const seriousOrWorse = results.violations.filter((violation) =>
        ["serious", "critical"].includes(violation.impact ?? ""),
      );
      expect(seriousOrWorse).toEqual([]);
    });
  }

  test("invalid section falls back; legacy topics redirect", async ({ page }) => {
    await page.goto(
      "/formal-topics/cedar-river-drought-surcharge?section=not-a-real-section",
    );
    await expect(
      page.getByRole("link", { name: "Overview", exact: true }),
    ).toHaveAttribute("aria-current", "page");

    await page.goto("/topics/cedar-river-drought-surcharge");
    await expect(page).toHaveURL(
      /\/formal-topics\/cedar-river-drought-surcharge$/,
    );

    await page.goto(
      "/topics/cedar-river-drought-surcharge?section=evidence",
    );
    await expect(page).toHaveURL(/section=evidence/);
  });

  test("deferred topic overview and reciprocal Idea Commons links", async ({
    page,
  }) => {
    await page.goto("/formal-topics/cedar-river-billing-ops-gap");
    await expect(
      page.getByRole("heading", {
        name: /billing-operations readiness/i,
      }),
    ).toBeVisible();
    await expect(page.getByText(/deferred/i).first()).toBeVisible();

    await page
      .getByRole("link", { name: "Discussions & Proposals", exact: true })
      .click();
    await page
      .getByRole("link", { name: /qualify billing-ops readiness/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/idea-commons\//);
    await expect(
      page.getByRole("link", {
        name: /Cedar River billing-operations readiness/i,
      }),
    ).toBeVisible();
  });
});
