import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { expectNoHorizontalOverflow } from "./gated-helpers";

test.describe("gated Agenda member deliberation", () => {
  test("member opens a synthetic topic, records a position, and tabs pass axe", async ({
    page,
  }) => {
    const identifier = `agenda-${Date.now()}@ostt.synth.test`;
    const password = "a-sufficiently-long-pass";
    const polisHits: string[] = [];
    page.on("request", (request) => {
      if (/pol\.is/i.test(request.url())) {
        polisHits.push(request.url());
      }
    });

    await page.goto("/join");
    await page.getByLabel(/identifier/i).fill(identifier);
    await page.getByLabel(/password/i).fill(password);
    await page.getByRole("checkbox").check();
    await page.waitForTimeout(1600);
    await page.getByRole("button", { name: /create account/i }).click();
    await expect(page).toHaveURL(/\/account/, { timeout: 30_000 });

    await page.goto("/agenda");
    await expect(page.getByRole("heading", { name: "Agenda" })).toBeVisible();
    await expect(page.getByTestId("hosted-polis-unavailable")).toBeVisible();
    await expect(
      page.getByRole("link", {
        name: /synthetic qualified topic: evening transit reliability/i,
      }),
    ).toBeVisible();

    await page
      .getByRole("link", {
        name: /synthetic qualified topic: evening transit reliability/i,
      })
      .click();
    await expect(page).toHaveURL(/\/agenda\/topics\/ostt-synth-evening-transit/);
    await expect(page.getByRole("navigation", { name: /topic sections/i })).toBeVisible();
    await expect(page.getByRole("link", { name: "Overview" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Evidence" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Discussion" })).toBeVisible();
    await expect(page.getByRole("link", { name: "History" })).toBeVisible();

    const html = await page.content();
    expect(html).not.toMatch(/https:\/\/pol\.is\/embed\.js/);
    expect(html).not.toMatch(/<script[^>]+pol\.is/i);

    await page.getByRole("button", { name: /^agree$/i }).first().click();
    await expect(page.getByRole("button", { name: /^agree$/i }).first()).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await page.getByRole("link", { name: "Evidence" }).click();
    await expect(page.getByRole("heading", { name: "Evidence" })).toBeVisible();
    await page.getByRole("link", { name: "History" }).click();
    await expect(page.getByRole("heading", { name: "History" })).toBeVisible();

    const axe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    const serious = axe.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact ?? ""),
    );
    expect(serious, serious.map((v) => v.id).join(", ")).toEqual([]);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await expect(page.getByRole("heading", { name: "History" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    expect(polisHits, polisHits.join(", ")).toEqual([]);
  });
});
