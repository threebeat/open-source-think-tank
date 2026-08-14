import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const principalRoutes = ["/", "/demo", "/join"] as const;

test.describe("principal-route accessibility", () => {
  for (const route of principalRoutes) {
    test(`${route} has no serious or critical axe violations`, async ({
      page,
    }) => {
      await page.goto(route);
      const results = await new AxeBuilder({ page }).analyze();
      const seriousOrWorse = results.violations.filter((violation) =>
        ["serious", "critical"].includes(violation.impact ?? ""),
      );
      expect(
        seriousOrWorse,
        seriousOrWorse.map((item) => `${item.id}: ${item.help}`).join("\n"),
      ).toEqual([]);
    });
  }
});
