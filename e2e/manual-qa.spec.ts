import { expect, test } from "@playwright/test";

/**
 * Automates Phase 1 manual-QA requirements that can be exercised in Playwright
 * (zoom, reduced motion, text resize, sticky controls, orientation, keyboard).
 * Results are recorded in docs/phase-1-manual-qa.md.
 */
test.describe("phase-1 manual QA automation", () => {
  test("keyboard activates guided-demo Next and moves focus to the step heading", async ({
    page,
  }) => {
    await page.goto("/demo");
    const next = page.getByRole("button", { name: "Next" });
    await next.focus();
    await expect(next).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("heading", { name: "1. Idea Commons discussion" }),
    ).toBeFocused();
  });

  test("sticky presentation bar remains visible while scrolling a stage page", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 720 });
    await page.goto("/decisions/cedar-river-drought-surcharge?demoStep=policy");
    const bar = page.getByRole("region", {
      name: "Guided demonstration controls",
    });
    await expect(bar).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(bar).toBeVisible();
    const box = await bar.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y).toBeLessThan(200);
  });

  test("phone landscape keeps presentation controls and decision content usable", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await page.goto("/decisions/cedar-river-drought-surcharge?demoStep=policy");
    await expect(
      page.getByRole("region", { name: "Guided demonstration controls" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Return to guided demo" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Policy Council roll call" }),
    ).toBeVisible();
  });

  test("browser zoom to 200% keeps primary demo controls reachable", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/demo");
    await page.evaluate(() => {
      document.documentElement.style.zoom = "2";
    });
    await expect(
      page.getByRole("heading", { name: "Guided demo", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Next" })).toBeVisible();
    await page.getByRole("button", { name: "Next" }).click();
    await expect(
      page.getByRole("heading", { name: "1. Idea Commons discussion" }),
    ).toBeVisible();
    await page.evaluate(() => {
      document.documentElement.style.zoom = "";
    });
  });

  test("text resizing to 200% keeps consultation controls usable", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/topics/cedar-river-drought-surcharge/consult");
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "200%";
    });
    await expect(
      page.getByRole("button", { name: "Agree", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Disagree", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Agree", exact: true }).click();
    await expect(page.getByText(/recorded|Agree/i).first()).toBeVisible();
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "";
    });
  });

  test("prefers-reduced-motion keeps demo and transitions usable", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/demo");
    const duration = await page.evaluate(() => {
      const probe = document.createElement("div");
      probe.style.transition = "opacity 220ms";
      document.body.appendChild(probe);
      const value = getComputedStyle(probe).transitionDuration;
      probe.remove();
      return value;
    });
    // Reduced-motion CSS forces near-instant transitions (0.01ms → browser-normalized).
    expect(duration === "0s" || /^(0\.0*1m?s|1e-0*5s)$/i.test(duration)).toBe(
      true,
    );
    await page.getByRole("button", { name: "Next" }).click();
    await expect(
      page.getByRole("heading", { name: "1. Idea Commons discussion" }),
    ).toBeVisible();
    await page.goto("/topics/cedar-river-drought-surcharge");
    await expect(
      page.getByRole("heading", {
        name: "Cedar River residential drought surcharge",
        exact: true,
      }),
    ).toBeVisible();
  });
});
