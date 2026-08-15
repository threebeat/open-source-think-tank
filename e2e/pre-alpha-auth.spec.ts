import { expect, test } from "@playwright/test";

test.describe("pre-alpha signup and sign-in", () => {
  test("create account, see halls, sign out, and sign back in", async ({
    page,
  }) => {
    const identifier = `member-${Date.now()}@ostt.synth.test`;
    const password = "a-sufficiently-long-pass";

    await page.goto("/join");
    await expect(
      page.getByRole("heading", { name: "Create an account" }),
    ).toBeVisible();
    await page.getByLabel(/identifier/i).fill(identifier);
    await page.getByLabel(/password/i).fill(password);
    await page.getByRole("checkbox").check();
    await page.waitForTimeout(1600);
    await page.getByRole("button", { name: /create account/i }).click();
    await expect(page).toHaveURL(/\/account/, { timeout: 30_000 });
    await expect(page.getByTestId("account-button")).toBeVisible();
    await expect(page.getByText(/Synthetic Alpha Hall/i).first()).toBeVisible();
    await expect(page.getByText(/Community member/i).first()).toBeVisible();

    await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Commons" }).click();
    await expect(page.getByRole("heading", { name: "Commons", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Formal Commons", exact: true })).toBeVisible();

    await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Agenda" }).click();
    await expect(page.getByRole("heading", { name: "Agenda" })).toBeVisible();

    await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Chamber" }).click();
    await expect(page.getByRole("heading", { name: "Chamber" })).toBeVisible();

    await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Council" }).click();
    await expect(page.getByRole("heading", { name: "Council" })).toBeVisible();

    await page.getByTestId("account-button").click();
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/$/);

    await page.goto("/auth/sign-in");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await page.getByLabel(/^identifier$/i).fill(identifier);
    await page.getByLabel(/^password$/i).fill(password);
    await page.getByRole("button", { name: /^sign in$/i }).click();
    await expect(page).toHaveURL(/\/account/, { timeout: 30_000 });
    await expect(page.getByTestId("account-button")).toBeVisible();
  });
});
