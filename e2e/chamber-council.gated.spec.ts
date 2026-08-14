import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { expectNoHorizontalOverflow } from "./gated-helpers";

test.describe("gated Chamber, Council, and Records", () => {
  test("member walks the seeded sidewalk topic and roll-call tables pass axe", async ({
    page,
  }) => {
    const identifier = `chamber-${Date.now()}@ostt.synth.test`;
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

    await page.goto("/chamber");
    await expect(page.getByRole("heading", { name: "Chamber" })).toBeVisible();
    await expect(
      page.getByText(/community membership does not grant a chamber seat/i),
    ).toBeVisible();
    await expect(
      page.getByRole("link", {
        name: /synthetic qualified topic: sidewalk repair/i,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", {
        name: /synthetic qualified topic: weekend library hours/i,
      }),
    ).toBeVisible();

    await page
      .getByRole("link", {
        name: /synthetic qualified topic: sidewalk repair/i,
      })
      .click();
    await expect(page).toHaveURL(/\/chamber\/topics\/ostt-synth-sidewalk-repair/);
    await expect(page.getByRole("heading", { name: "Roll call" })).toBeVisible();
    await expect(page.getByRole("table", { name: /chamber roll call/i })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Position" })).toBeVisible();
    await expect(page.getByText(/^yes$/i).first()).toBeVisible();
    await expect(page.getByText(/^no$/i).first()).toBeVisible();
    await expect(page.getByText(/^recused$/i).first()).toBeVisible();
    await expect(page.getByRole("time").first()).toBeVisible();
    await expect(page.getByRole("time").first()).toHaveText(/CDT|CST|CT|Chicago/i);

    await page.goto("/council/topics/ostt-synth-sidewalk-repair");
    await expect(
      page.getByRole("heading", {
        name: /synthetic qualified topic: sidewalk repair/i,
      }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Roll call" })).toBeVisible();
    await expect(page.getByRole("table", { name: /council roll call/i })).toBeVisible();
    await expect(page.getByText(/^abstain$/i).first()).toBeVisible();
    await expect(page.getByText(/^absent$/i).first()).toBeVisible();
    await expect(page.getByText(/left public agenda/i).first()).toBeVisible();

    await page.goto("/records");
    await expect(page.getByRole("heading", { name: "Records" })).toBeVisible();
    await page
      .getByRole("link", {
        name: /synthetic qualified topic: sidewalk repair/i,
      })
      .click();
    await expect(page).toHaveURL(/\/records\/topics\/ostt-synth-sidewalk-repair/);
    await expect(
      page.getByRole("heading", { name: /Council recommendation version/i }),
    ).toBeVisible();

    const html = await page.content();
    expect(html).not.toMatch(/https:\/\/pol\.is\/embed\.js/);

    const axe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    const serious = axe.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact ?? ""),
    );
    expect(serious, serious.map((v) => v.id).join(", ")).toEqual([]);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await expect(
      page.getByRole("heading", { name: /Council recommendation version/i }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
    expect(polisHits, polisHits.join(", ")).toEqual([]);
  });
});
