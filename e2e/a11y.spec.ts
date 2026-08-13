import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const principalRoutes = [
  "/",
  "/about",
  "/join",
  "/process",
  "/topics",
  "/formal-topics/cedar-river-drought-surcharge",
  "/formal-topics/cedar-river-drought-surcharge?section=evidence",
  "/formal-topics/cedar-river-drought-surcharge?section=discussions",
  "/topics/cedar-river-drought-surcharge/consult",
  "/formal-topics/millbrook-ems-open-data",
  "/agenda",
  "/agenda/cedar-river-drought-surcharge",
  "/deliberation/cedar-river-drought-surcharge",
  "/decisions/cedar-river-drought-surcharge",
  "/transparency",
  "/demo",
] as const;

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
