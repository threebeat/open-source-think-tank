import { expect, test } from "@playwright/test";

test.describe("topics and evidence", () => {
  test("lists topics and shows distinct evidence-review states", async ({
    page,
  }) => {
    await page.goto("/topics");
    await expect(
      page.getByRole("heading", { name: "Topics", exact: true }),
    ).toBeVisible();
    const cedarLink = page.getByRole("link", {
      name: "Cedar River residential drought surcharge",
      exact: true,
    });
    await expect(cedarLink).toHaveAttribute(
      "href",
      "/topics/cedar-river-drought-surcharge",
    );
    await page.goto("/topics/cedar-river-drought-surcharge");
    await expect(
      page.getByText("Popularity is not evidence quality"),
    ).toBeVisible();
    await expect(page.getByText("Review: Pending").first()).toBeVisible();
    await expect(page.getByText("Review: Disputed").first()).toBeVisible();
    await expect(page.getByText("Review: Accepted").first()).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Research Review Status" }),
    ).toBeVisible();
    await expect(page.locator("#evidence-basin-storage-note")).toBeVisible();
  });

  test("shows an explicit missing-evidence state on brief-stage topics", async ({
    page,
  }) => {
    await page.goto("/topics/millbrook-ems-open-data");
    await expect(
      page.getByRole("heading", {
        name: "Millbrook County EMS response-time open data",
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Evidence inventory" }),
    ).toBeVisible();
    await expect(
      page.getByText(/No evidence sources are attached yet/i),
    ).toBeVisible();
  });

  test("filters by subject and independent status", async ({ page }) => {
    await page.goto("/topics");
    await page.locator("#topic-subject-filter").selectOption("education");
    await expect(
      page.getByRole("link", {
        name: "Northline secondary-school start times",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", {
        name: "Millbrook County EMS response-time open data",
        exact: true,
      }),
    ).toHaveCount(0);

    await page.locator("#topic-subject-filter").selectOption("all");
    await page.locator("#topic-status-filter").selectOption("closed");
    await expect(
      page.getByRole("link", {
        name: "Cedar River residential drought surcharge",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", {
        name: "Northline secondary-school start times",
        exact: true,
      }),
    ).toHaveCount(0);
  });
});
