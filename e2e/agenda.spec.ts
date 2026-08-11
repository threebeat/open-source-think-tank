import { expect, test } from "@playwright/test";

test.describe("agenda gate", () => {
  test("lists every agenda status and shows a transparent calculation", async ({
    page,
  }) => {
    await page.goto("/agenda");
    await expect(
      page.getByRole("heading", { name: "Decide What Moves Forward", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Proposed", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Qualified", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Deferred", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Rejected", exact: true }),
    ).toBeVisible();

    const qualifiedLink = page.getByRole("link", {
      name: "Qualify graduated drought-surcharge question for deliberation",
      exact: true,
    });
    await expect(qualifiedLink).toHaveAttribute(
      "href",
      "/agenda/cedar-river-drought-surcharge",
    );
    // Avoid sticky chrome intercepting mid-page clicks after scrollIntoView.
    await page.goto("/agenda/cedar-river-drought-surcharge");
    await expect(
      page.getByText("No combined truth score", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Public Criteria" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "How This Result Was Calculated" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Human review" }),
    ).toBeVisible();
    await expect(page.getByText(/Sensitivity note:/i)).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Open public input report path/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Open fact-check & research record/i }),
    ).toBeVisible();
  });
});
