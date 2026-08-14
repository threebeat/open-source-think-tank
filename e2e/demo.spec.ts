import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("guided demonstration", () => {
  test("walks the Commonhall process tour without an account", async ({
    page,
  }) => {
    await page.goto("/demo");
    await expect(
      page.getByRole("heading", { name: "Tour Commonhall" }),
    ).toBeVisible();
    await expect(
      page.getByText(/not a live town hall/i).first(),
    ).toBeVisible();
    await expect(
      page.getByText(/Hosted Pol.is remains unavailable/i).first(),
    ).toBeVisible();

    await page.getByRole("button", { name: "Next" }).click();
    await expect(
      page.getByRole("heading", { name: "2. Qualification" }),
    ).toBeVisible();

    await page.getByRole("button", { name: /6\. Records/i }).click();
    await expect(
      page.getByRole("heading", { name: "6. Records" }),
    ).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();
    const seriousOrWorse = results.violations.filter((violation) =>
      ["serious", "critical"].includes(violation.impact ?? ""),
    );
    expect(seriousOrWorse).toEqual([]);
  });
});
