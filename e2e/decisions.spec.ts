import { expect, test } from "@playwright/test";

test.describe("decision record and transparency", () => {
  test("shows decision roll call, minority report, and transparency protections", async ({
    page,
  }) => {
    await page.goto("/decisions/cedar-river-drought-surcharge");
    await expect(
      page.getByRole("heading", {
        name: "Cedar River residential drought surcharge",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByText("Recommendation, not settled adoption", { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Roll call" })).toBeVisible();
    await expect(page.getByText("Ada Nguyen")).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: /Minority report — prefer voluntary-first extension/i,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Deliberation" }),
    ).toHaveAttribute("href", "/deliberation/cedar-river-drought-surcharge");

    await page.goto("/transparency");
    await expect(
      page.getByRole("heading", { name: "Transparency", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Synthetic append-only audit feed" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: "Open by default / Protected by necessity",
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("rowheader", {
        name: "Granular political-opinion histories",
      }),
    ).toBeVisible();
    await expect(page.getByText("Protected by necessity").first()).toBeVisible();
    await expect(
      page.getByText("agenda-threshold-trace@0.1.0", { exact: true }),
    ).toBeVisible();
  });
});
