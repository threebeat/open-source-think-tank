import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { expectNoHorizontalOverflow } from "./gated-helpers";

test.describe("gated member walkthrough", () => {
  test("enroll, post, record a position, and observe sidewalk Chamber/Council/Records", async ({
    page,
  }) => {
    const identifier = `walkthrough-${Date.now()}@ostt.synth.test`;
    const password = "a-sufficiently-long-pass";
    const title = `Walkway lighting ${Date.now()}`;
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
    await expect(
      page.getByText(/not nonprofit or statutory membership/i).first(),
    ).toBeVisible();

    await page.goto("/commons");
    await expect(
      page.getByRole("heading", { name: "Commons", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Create a post" })).toBeVisible();
    await page.locator("select[name='category']").selectOption("general_discussion");
    await page.getByLabel(/^title$/i).fill(title);
    await page.getByLabel(/^body$/i).fill(
      "Should the hall add lighting on the river walkway?",
    );
    await page.getByRole("button", { name: /^create post$/i }).click();
    await expect(page.getByRole("heading", { name: title })).toBeVisible({
      timeout: 15_000,
    });

    await page.goto("/agenda/topics/ostt-synth-evening-transit");
    await expect(page.getByRole("button", { name: /^agree$/i }).first()).toBeVisible();
    await page.getByRole("button", { name: /^agree$/i }).first().click();
    await expect(
      page.getByRole("button", { name: /^agree$/i }).first(),
    ).toHaveAttribute("aria-pressed", "true");

    await page.goto("/chamber/topics/ostt-synth-sidewalk-repair");
    await expect(page.getByRole("heading", { name: "Roll call" })).toBeVisible();
    await expect(page.getByRole("table", { name: /chamber roll call/i })).toBeVisible();

    await page.goto("/council/topics/ostt-synth-sidewalk-repair");
    await expect(page.getByRole("table", { name: /council roll call/i })).toBeVisible();

    await page.goto("/records/topics/ostt-synth-sidewalk-repair");
    await expect(
      page.getByRole("heading", { name: /Council recommendation version/i }),
    ).toBeVisible();

    const html = await page.content();
    expect(html).not.toMatch(/https:\/\/pol\.is\/embed\.js/);
    expect(polisHits, polisHits.join(", ")).toEqual([]);

    const axe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    const serious = axe.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact ?? ""),
    );
    expect(serious, serious.map((v) => v.id).join(", ")).toEqual([]);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await expectNoHorizontalOverflow(page);
  });
});
