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
    await expect(
      page.getByRole("heading", { name: "Policy Council roll call" }),
    ).toBeVisible();
    await expect(page.getByText("Ada Nguyen")).toBeVisible();
    await expect(page.getByText("Farah Quinn", { exact: true })).toBeVisible();
    await expect(
      page.getByText(/grounds the recorded step-aside because of a conflict/i),
    ).toBeVisible();
    await expect(
      page.getByText(/research stipend from a fictional water-efficiency nonprofit/i),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: /Minority report — prefer voluntary-first extension/i,
      }),
    ).toBeVisible();
    const versionTwo = page.locator("details").filter({ hasText: "Version 2" });
    await versionTwo.locator("summary").click();
    await expect(
      versionTwo.getByText(
        /Draft v2 keeps graduated stages, adds a hardship rebate path/i,
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("link", {
        name: "Open version 2 in policy drafting navigator",
      }),
    ).toHaveAttribute(
      "href",
      "/deliberation/cedar-river-drought-surcharge?version=2#proposal-versions",
    );
    await expect(
      page.getByRole("link", { name: "State-Level Policy Drafting", exact: true }),
    ).toHaveAttribute("href", "/deliberation/cedar-river-drought-surcharge");

    await page.goto("/transparency");
    await expect(
      page.getByRole("heading", { name: "The Public Record", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Demonstration Activity History" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: "What We Publish / What We Protect",
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("rowheader", {
        name: "Granular political-opinion histories",
      }),
    ).toBeVisible();
    await expect(page.getByText("What We Protect").first()).toBeVisible();
    await expect(
      page.getByText("agenda-threshold-trace@0.1.0", { exact: true }),
    ).toBeVisible();
  });
});
