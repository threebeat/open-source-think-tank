import { expect, test } from "@playwright/test";

test.describe("about", () => {
  test("presents project framing, commitments, limitations, and contact placeholder", async ({
    page,
  }) => {
    await page.goto("/about");
    await expect(
      page.getByRole("heading", { name: "About this demonstration" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Mission (proposed)" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Openness commitments in this prototype" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Phase 1 limitations" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Contact placeholder" }),
    ).toBeVisible();
    await expect(
      page.getByText("will live here", { exact: false }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Open guided demo" }),
    ).toHaveAttribute("href", "/demo");
  });
});
