import { expect, test } from "@playwright/test";

test.describe("topics and evidence", () => {
  test("lists topics via Formal Topics and shows distinct evidence-review states", async ({
    page,
  }) => {
    await page.goto("/topics");
    await expect(page).toHaveURL(/\/formal-topics$/);
    await expect(
      page.getByRole("heading", { name: "Formal Topic Pipeline", exact: true }),
    ).toBeVisible();
    const cedarLink = page.getByRole("link", {
      name: "Cedar River residential drought surcharge",
      exact: true,
    }).first();
    await expect(cedarLink).toHaveAttribute(
      "href",
      "/formal-topics/cedar-river-drought-surcharge",
    );

    await page.goto(
      "/formal-topics/cedar-river-drought-surcharge?section=evidence",
    );
    await expect(
      page.getByText("Not a popularity ranking"),
    ).toBeVisible();
    await expect(page.getByText("Review: Pending").first()).toBeVisible();
    await expect(page.getByText("Review: Disputed").first()).toBeVisible();
    await expect(page.getByText("Review: Accepted").first()).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Research Review Status" }),
    ).toBeVisible();
    await expect(page.locator("#evidence-basin-storage-note")).toBeVisible();
    await expect(page.getByLabel(/Sort inventory/i)).toBeVisible();
  });

  test("shows an explicit missing-evidence state on brief-stage topics", async ({
    page,
  }) => {
    await page.goto("/formal-topics/millbrook-ems-open-data?section=evidence");
    await expect(
      page.getByRole("heading", {
        name: "Shelby County EMS response-time open data",
      }),
    ).toBeVisible();
    await expect(
      page.getByText(/No evidence submitted|No evidence sources are attached yet/i),
    ).toBeVisible();
  });

  test("supports advanced search, proposed opt-in, and URL state", async ({
    page,
  }) => {
    await page.goto("/formal-topics");
    await page.getByRole("button", { name: /Advanced search/i }).click();
    await page.locator("#topic-subject-filter").selectOption("education");
    await expect(page).toHaveURL(/subject=education/);
    await expect(
      page.getByRole("link", {
        name: "Knox County secondary-school start times",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", {
        name: "Shelby County EMS response-time open data",
        exact: true,
      }),
    ).toHaveCount(0);

    await page.locator("#topic-subject-filter").selectOption("all");
    await expect(page).not.toHaveURL(/subject=education/);
    await page.locator("#topic-status-filter").selectOption("closed");
    await expect(page).toHaveURL(/status=closed/);
    await expect(
      page.getByRole("link", {
        name: "Cedar River residential drought surcharge",
        exact: true,
      }).first(),
    ).toBeVisible();

    await page.getByRole("button", { name: /Clear all/i }).click();
    await page.getByRole("button", { name: /Advanced search/i }).click();
    await page.locator("#topic-proposed-filter").selectOption("include");
    await expect(page).toHaveURL(/proposed=include/);
    await expect(
      page.getByRole("link", { name: /Blount County greenway/i }),
    ).toBeVisible();
  });
});
