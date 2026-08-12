import { expect, test } from "@playwright/test";

test.describe("guided demonstration", () => {
  test("visits every stage, returns via presentation controls, and restores on refresh", async ({
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

    await page.getByRole("button", { name: "Next" }).click();
    await expect(
      page.getByRole("heading", { name: "How Joining Works" }),
    ).toBeFocused();
    await page.getByRole("link", { name: "Open how joining works" }).click();
    await expect(page).toHaveURL(/\/join\?demoStep=join/);
    await expect(
      page.getByRole("region", { name: "Guided demonstration controls" }),
    ).toBeVisible();
    await expect(
      page.getByText("Not accepting members", { exact: true }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Return to guided demo" }).click();
    await expect(page).toHaveURL(/\/demo\?step=join/);
    await expect(
      page.getByRole("heading", { name: "How Joining Works" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("link", { name: "Open Cedar River topic" }).click();
    await expect(page).toHaveURL(
      /\/topics\/cedar-river-drought-surcharge\?demoStep=topics/,
    );
    await expect(
      page.getByRole("heading", {
        name: "Cedar River residential drought surcharge",
        exact: true,
      }),
    ).toBeVisible();
    await page
      .getByRole("link", { name: "Continue to Public Input (simulated)" })
      .click();
    await expect(page).toHaveURL(
      /\/topics\/cedar-river-drought-surcharge\/consult\?demoStep=consultation/,
    );
    await expect(
      page.getByRole("button", { name: "Agree", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("link", { name: "Continue to Decide What Moves Forward" })
      .click();
    await expect(page).toHaveURL(
      /\/agenda\/cedar-river-drought-surcharge\?demoStep=agenda/,
    );
    await expect(
      page.getByRole("heading", { name: "How This Result Was Calculated" }),
    ).toBeVisible();
    await page
      .getByRole("link", { name: "Continue to State-Level Policy Drafting (observer view)" })
      .click();
    await expect(page).toHaveURL(
      /\/deliberation\/cedar-river-drought-surcharge\?demoStep=deliberation/,
    );
    await expect(
      page.getByText("Public observation only", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("link", { name: "Continue to Recommendation & Council Vote" })
      .click();
    await expect(page).toHaveURL(
      /\/decisions\/cedar-river-drought-surcharge\?demoStep=decision/,
    );
    await expect(
      page.getByRole("heading", { name: "Policy Council roll call" }),
    ).toBeVisible();
    await expect(
      page.getByText(/grounds the recorded step-aside because of a conflict/i),
    ).toBeVisible();
    await page
      .getByRole("link", { name: "Continue to Workflow practice" })
      .click();
    await expect(page).toHaveURL(/\/demo\/workflow\?demoStep=workflow/);
    await expect(
      page.getByRole("heading", {
        name: "Workflow practice",
        exact: true,
      }),
    ).toBeVisible();
    await page
      .getByRole("link", { name: "Continue to The Public Record" })
      .click();
    await expect(page).toHaveURL(/\/transparency\?demoStep=transparency/);
    await expect(
      page.getByRole("heading", { name: "The Public Record", exact: true }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Return to guided demo" }).click();
    await expect(page).toHaveURL(/\/demo\?step=transparency/);

    await page.getByRole("button", { name: "Next" }).click();
    await expect(
      page.getByRole("heading", { name: "Questions for legal counsel" }),
    ).toBeVisible();
    await expect(page.getByText("Audience stop")).toBeVisible();
    await page.getByRole("button", { name: "Next" }).click();
    await expect(
      page.getByRole("heading", { name: "Questions for technical collaborators" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Next" }).click();
    await expect(
      page.getByRole("heading", {
        name: "Questions for prospective board members",
      }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Next" }).click();
    await expect(
      page.getByRole("heading", { name: "Close and reset" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Back", exact: true }).click();
    await expect(
      page.getByRole("heading", {
        name: "Questions for prospective board members",
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: "Questions for prospective board members",
      }),
    ).toBeFocused();

    await page.reload();
    await expect(page).toHaveURL(/\/demo\?step=questions-board/);
    await expect(
      page.getByRole("heading", {
        name: "Questions for prospective board members",
      }),
    ).toBeVisible();

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
