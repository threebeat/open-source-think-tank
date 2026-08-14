import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("gated open enrollment", () => {
  test("register → sign-in → account; cannot open org admin", async ({
    page,
  }) => {
    const identifier = `member-${Date.now()}@ostt.synth.test`;
    const password = "a-sufficiently-long-pass";

    await page.goto("/join");
    await expect(page.getByRole("heading", { name: /create an account/i })).toBeVisible();
    await page.getByLabel(/identifier/i).fill(identifier);
    await page.getByLabel(/password/i).fill(password);
    await page.getByRole("checkbox").check();
    await page.waitForTimeout(1600);
    await page.getByRole("button", { name: /create account/i }).click();
    await expect(page).toHaveURL(/\/account/, { timeout: 30_000 });
    await expect(page.getByText(/Synthetic Alpha Hall/i).first()).toBeVisible();
    await expect(
      page.getByText(/not nonprofit or statutory membership/i).first(),
    ).toBeVisible();

    await page.goto("/account/membership");
    await expect(page.getByRole("heading", { name: "Membership" })).toBeVisible();
    await expect(page.getByText(/primary/i).first()).toBeVisible();

    await page.goto("/account/history");
    await expect(page.getByText(/assignment/i).first()).toBeVisible();

    await page.goto("/commons");
    await expect(page.getByRole("heading", { name: "Commons", exact: true })).toBeVisible();
    await expect(
      page.getByText(
        /Informal conversations may not have been reviewed by a moderator/,
      ),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Create a post" })).toBeVisible();

    await page.goto("/org/ostt-synth-alpha/settings");
    await expect(page).not.toHaveURL(/\/org\/ostt-synth-alpha\/settings/);

    const axe = await new AxeBuilder({ page }).analyze();
    const serious = axe.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact ?? ""),
    );
    expect(serious, serious.map((v) => v.id).join(", ")).toEqual([]);

    await page.context().clearCookies();
    await page.goto("/auth/sign-in");
    await page.getByLabel(/^identifier$/i).fill(identifier);
    await page.getByLabel(/^password$/i).fill(password);
    await page.getByRole("button", { name: /^sign in$/i }).click();
    await expect(page).toHaveURL(/\/account/, { timeout: 30_000 });
  });

  test("invite bootstrap path remains available", async ({ page }) => {
    await page.goto("/auth/accept");
    await expect(page.getByRole("heading", { name: /invitation/i })).toBeVisible();
  });
});
