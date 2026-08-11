import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const viewports = [
  { name: "320-portrait", width: 320, height: 568 },
  { name: "375-portrait", width: 375, height: 812 },
  { name: "390-portrait", width: 390, height: 844 },
  { name: "430-portrait", width: 430, height: 932 },
  { name: "390-landscape", width: 844, height: 390 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 800 },
] as const;

async function assertNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return {
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
    };
  });
  expect(
    overflow.scrollWidth,
    `horizontal overflow at ${overflow.scrollWidth}px > ${overflow.clientWidth}px`,
  ).toBeLessThanOrEqual(overflow.clientWidth + 1);
}

test.describe("application shell", () => {
  test("banner remains visible and primary nav is keyboard-reachable", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");

    await expect(
      page.getByText("Demonstration — synthetic data only."),
    ).toBeVisible();

    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    // Focus moves through banner/header controls into primary nav.
    let reachedProcess = false;
    for (let i = 0; i < 12; i += 1) {
      const activeName = await page.evaluate(() => {
        const el = document.activeElement;
        return el?.textContent?.trim() ?? "";
      });
      if (activeName === "Process") {
        reachedProcess = true;
        break;
      }
      await page.keyboard.press("Tab");
    }
    expect(reachedProcess).toBe(true);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/process$/);
    await expect(page.getByRole("heading", { name: "Process" })).toBeVisible();
  });

  test("mobile menu scrolls within the viewport and routes without overflow", async ({
    page,
  }) => {
    for (const viewport of viewports) {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await page.goto("/");
      await assertNoHorizontalOverflow(page);

      if (viewport.width < 1024) {
        await page.getByRole("button", { name: "Menu" }).focus();
        await page.keyboard.press("Enter");
        const mobileNav = page.getByRole("navigation", {
          name: "Primary mobile",
        });
        await expect(mobileNav).toBeVisible();

        const menuBox = page.getByTestId("mobile-primary-nav");
        await expect(menuBox).toBeVisible();
        const overflowY = await menuBox.evaluate((node) => {
          const styles = window.getComputedStyle(node);
          return {
            overflowY: styles.overflowY,
            maxHeight: styles.maxHeight,
          };
        });
        expect(["auto", "scroll", "overlay"]).toContain(overflowY.overflowY);
        expect(overflowY.maxHeight).not.toBe("none");

        await mobileNav
          .getByRole("link", { name: "The Public Record", exact: true })
          .focus();
        await page.keyboard.press("Enter");
        await expect(page).toHaveURL(/\/transparency$/);
        await assertNoHorizontalOverflow(page);
      } else {
        await expect(
          page.getByRole("navigation", { name: "Primary" }),
        ).toBeVisible();
        await assertNoHorizontalOverflow(page);
      }
    }

    const results = await new AxeBuilder({ page }).analyze();
    const seriousOrWorse = results.violations.filter((violation) =>
      ["serious", "critical"].includes(violation.impact ?? ""),
    );
    expect(seriousOrWorse).toEqual([]);
  });
});
