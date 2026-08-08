import { expect, test } from "@playwright/test";

test.describe("topics and evidence", () => {
  test("lists topics and shows distinct evidence-review states", async ({
    page,
  }) => {
    await page.goto("/topics");
    await expect(page.getByRole("heading", { name: "Topics" })).toBeVisible();
    await page.getByRole("link", { name: /Cedar River/i }).click();
    await expect(page).toHaveURL(/\/topics\/cedar-river-drought-surcharge$/);
    await expect(
      page.getByText("Popularity is not evidence quality"),
    ).toBeVisible();
    await expect(page.getByText("Review: Pending").first()).toBeVisible();
    await expect(page.getByText("Review: Disputed").first()).toBeVisible();
    await expect(page.getByText("Review: Accepted").first()).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "How evidence is reviewed" }),
    ).toBeVisible();
  });
});
