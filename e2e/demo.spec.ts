import { expect, test } from "@playwright/test";

test.describe("guided demonstration", () => {
  test("walks the full guided path with notes, reset, and stage links", async ({
    page,
  }) => {
    await page.goto("/demo");
    await expect(
      page.getByRole("heading", { name: "Guided demo", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Presentation mode — not an operational system"),
    ).toBeVisible();

    await page.getByRole("button", { name: "Show presenter notes" }).click();
    await expect(page.getByLabel("Presenter notes")).toBeVisible();

    for (let i = 0; i < 11; i += 1) {
      await page.getByRole("button", { name: "Next" }).click();
    }

    await expect(
      page.getByRole("heading", { name: "Close and reset" }),
    ).toBeVisible();

    await page.getByRole("button", { name: /Questions for legal counsel/i }).click();
    await expect(
      page.getByRole("heading", { name: "Questions for legal counsel" }),
    ).toBeVisible();
    await expect(page.getByText("Audience stop")).toBeVisible();

    await page.getByRole("button", { name: /Questions for technical collaborators/i }).click();
    await expect(
      page.getByRole("heading", { name: "Questions for technical collaborators" }),
    ).toBeVisible();

    await page.getByRole("button", { name: /Questions for prospective board members/i }).click();
    await expect(
      page.getByRole("heading", {
        name: "Questions for prospective board members",
      }),
    ).toBeVisible();

    await page.getByRole("button", { name: /Policy Council decision record/i }).click();
    await expect(
      page.getByRole("link", { name: "Open decision record" }),
    ).toHaveAttribute("href", "/decisions/cedar-river-drought-surcharge");

    await page.getByRole("button", { name: "Reset", exact: true }).click();
    await expect(
      page.getByRole("heading", {
        name: "Start: synthetic demonstration only",
      }),
    ).toBeVisible();
    await expect(page.getByLabel("Presenter notes")).toHaveCount(0);

    await page.reload();
    await expect(
      page.getByRole("heading", {
        name: "Start: synthetic demonstration only",
      }),
    ).toBeVisible();
  });
});
