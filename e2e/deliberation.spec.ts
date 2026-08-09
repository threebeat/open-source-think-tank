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

    const version3 = page.getByRole("tab", { name: "Version 3" });
    await expect(version3).toHaveAttribute("aria-selected", "true");
    await expect(version3).toHaveAttribute("tabindex", "0");
    await expect(page.getByRole("tab", { name: "Version 1" })).toHaveAttribute(
      "tabindex",
      "-1",
    );

    await version3.focus();
    await page.keyboard.press("Home");
    const version1 = page.getByRole("tab", { name: "Version 1" });
    await expect(version1).toBeFocused();
    await expect(version1).toHaveAttribute("aria-selected", "true");
    await expect(
      page.getByRole("tabpanel").getByText(/essential indoor allotment/i),
    ).toBeVisible();

    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("tab", { name: "Version 2" })).toBeFocused();
    await page.keyboard.press("End");
    await expect(page.getByRole("tab", { name: "Version 3" })).toBeFocused();
    await expect(
      page.getByRole("tabpanel").getByText(/sunset review/i),
    ).toBeVisible();

    await expect(page.getByText("Add hardship rebate path")).toBeVisible();
    await expect(page.getByText("Add sunset review date")).toBeVisible();
    await expect(
      page.getByRole("link", {
        name: /Evidence \(limited\): Household bill impact vignettes/i,
      }),
    ).toBeVisible();
    const sunsetLink = page.getByRole("link", {
      name: /Consultation statement: .*sunset/i,
    });
    await expect(sunsetLink).toHaveAttribute(
      "href",
      /\/consult#stmt-sunset-clause$/,
    );
    await expect(
      page
        .getByRole("link", {
          name: /Evidence \(pending\): Billing system change estimate/i,
        })
        .first(),
    ).toHaveAttribute("href", /#evidence-billing-ops-brief$/);
    await expect(
      page.getByText(/would lapse unless renewed by the legally authorized body/i),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Recusal", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Public redaction reason", { exact: true }),
    ).toBeVisible();

    await sunsetLink.click();
    await expect(page).toHaveURL(/\/consult#stmt-sunset-clause$/);
    await expect(page.locator("#stmt-sunset-clause")).toBeVisible();
  });
});
