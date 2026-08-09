import { expect, test } from "@playwright/test";

test.describe("deliberation observer", () => {
  test("shows proposal versions, amendments, and observer boundaries", async ({
    page,
  }) => {
    await page.goto("/deliberation/cedar-river-drought-surcharge");
    await expect(
      page.getByRole("heading", {
        name: "Cedar River residential drought surcharge",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByText("Public observation only", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(/Closed means capacity-limited participation/i),
    ).toBeVisible();

    await page.getByRole("tab", { name: "Version 1" }).click();
    await expect(
      page.getByRole("tabpanel").getByText(/essential indoor allotment/i),
    ).toBeVisible();
    await page.getByRole("tab", { name: "Version 3" }).click();
    await expect(
      page.getByRole("tabpanel").getByText(/sunset review/i),
    ).toBeVisible();

    await expect(page.getByText("Add hardship rebate path")).toBeVisible();
    await expect(page.getByText("Add sunset review date")).toBeVisible();
    await expect(page.getByText("Accepted").first()).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Recusal", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Public redaction reason", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Evidence \(pending\):/i }),
    ).toHaveAttribute(
      "href",
      /#evidence-billing-ops-brief$/,
    );
  });
});
