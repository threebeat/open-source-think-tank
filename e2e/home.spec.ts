import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("home smoke", () => {
  test("shows Commonhall landing, demo CTA, and has no serious a11y violations", async ({
    page,
  }) => {
    const polisHits: string[] = [];
    page.on("request", (request) => {
      if (/pol\.is/i.test(request.url())) {
        polisHits.push(request.url());
      }
    });

    await page.goto("/");

    await expect(
      page.getByText(
        "Pre-alpha Commonhall — synthetic data only. Not a government or nonprofit membership.",
      ),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Commonhall" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Tour the demo" }).first()).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Create an account" }).first(),
    ).toBeVisible();
    await expect(
      page.getByText(/not nonprofit membership, statutory membership/i).first(),
    ).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();
    const seriousOrWorse = results.violations.filter((violation) =>
      ["serious", "critical"].includes(violation.impact ?? ""),
    );

    expect(seriousOrWorse).toEqual([]);
    expect(polisHits).toEqual([]);
  });
});
