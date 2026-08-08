import { expect, test } from "@playwright/test";

test.describe("join preview", () => {
  test("disables enrollment and shows not-legally-reviewed placeholders", async ({
    page,
  }) => {
    await page.goto("/join");
    await expect(
      page.getByRole("heading", { name: "Join preview" }),
    ).toBeVisible();
    await page.getByRole("button", { name: /Conduct assent/i }).click();
    await expect(page.getByText("Not legally reviewed").first()).toBeVisible();
    await page.getByRole("button", { name: /Stronger verification/i }).click();
    await expect(
      page.getByRole("button", { name: "Create account (disabled)" }),
    ).toBeDisabled();
    await expect(
      page.getByText("This prototype does not collect information"),
    ).toBeVisible();
  });
});
