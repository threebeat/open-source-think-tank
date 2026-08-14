import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("legacy demo workflow redirect", () => {
  test("/demo/workflow is a thin redirect onto the Commonhall process tour", async ({
    page,
  }) => {
    const polisHits: string[] = [];
    page.on("request", (request) => {
      if (/pol\.is/i.test(request.url())) {
        polisHits.push(request.url());
      }
    });

    await page.goto("/demo/workflow");
    await expect(page).toHaveURL(/\/demo$/);
    await expect(
      page.getByRole("heading", { name: "Tour Commonhall" }),
    ).toBeVisible();
    await expect(
      page.getByText(/Hosted Pol\.is is unavailable/i).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Workflow practice" }),
    ).toHaveCount(0);

    const html = await page.content();
    expect(html).not.toMatch(/https:\/\/pol\.is\/embed\.js/);

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    const serious = results.violations.filter((violation) =>
      ["serious", "critical"].includes(violation.impact ?? ""),
    );
    expect(serious).toEqual([]);
    expect(polisHits).toEqual([]);
  });
});
