import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("guided demonstration", () => {
  test("walks the interactive hall without an account", async ({ page }) => {
    const polisHits: string[] = [];
    page.on("request", (request) => {
      if (/pol\.is/i.test(request.url())) {
        polisHits.push(request.url());
      }
    });

    await page.goto("/demo");
    await expect(
      page.getByRole("heading", { name: "Tour Commonhall" }),
    ).toBeVisible();
    await expect(
      page.getByText(/not a live town hall/i).first(),
    ).toBeVisible();
    await expect(
      page.getByText(/Hosted Pol.is is unavailable/i).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "1. Commons" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Formal Commons", exact: true }),
    ).toBeVisible();

    await page
      .getByRole("button", { name: /Should we add lighting/i })
      .click();
    await expect(
      page.getByText(/Evening walkers say the last two blocks/i),
    ).toBeVisible();
    await page.getByPlaceholder(/Type a short reaction/i).fill("Looks useful.");
    await expect(page.getByText(/Draft kept locally/i)).toBeVisible();

    await page.getByRole("button", { name: "Next" }).click();
    await expect(
      page.getByRole("heading", { name: "2. Public Agenda" }),
    ).toBeVisible();
    await page.getByRole("button", { name: /^agree$/i }).first().click();
    await expect(page.getByRole("button", { name: /^agree$/i }).first()).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await page.getByRole("button", { name: /3\. Chamber/i }).click();
    await expect(page.getByRole("heading", { name: "3. Chamber" })).toBeVisible();
    await page.getByRole("button", { name: "Sam Okonkwo" }).click();
    await expect(page.getByText(/Sam Okonkwo recorded/i)).toBeVisible();

    await page.getByRole("button", { name: "Next" }).click();
    await expect(
      page.getByRole("heading", { name: "4. Council Agenda" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Finish" }).click();
    await expect(
      page.getByRole("heading", { name: "You have walked the hall" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Create an account" }),
    ).toBeVisible();

    const html = await page.content();
    expect(html).not.toMatch(/https:\/\/pol\.is\/embed\.js/);

    const results = await new AxeBuilder({ page }).analyze();
    const seriousOrWorse = results.violations.filter((violation) =>
      ["serious", "critical"].includes(violation.impact ?? ""),
    );
    expect(seriousOrWorse).toEqual([]);
    expect(polisHits).toEqual([]);
  });
});
