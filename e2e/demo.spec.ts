import { expect, test } from "@playwright/test";

test.describe("guided demonstration", () => {
  test("walks the computational-democracy journey and restores on refresh", async ({
    page,
  }) => {
    await page.goto("/demo");
    await expect(
      page.getByRole("heading", { name: "Guided demo", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Presentation mode — not an operational system"),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: /Follow an idea from community discussion to collective action/i,
      }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Show presenter notes" }).click();
    await expect(page.getByLabel("Presenter notes")).toBeVisible();

    await page.getByRole("button", { name: "Next" }).click();
    await expect(
      page.getByRole("heading", { name: "1. Idea Commons discussion" }),
    ).toBeFocused();
    await page.getByRole("link", { name: "Open Idea Commons" }).click();
    await expect(page).toHaveURL(/\/idea-commons\?demoStep=idea-commons/);
    await expect(
      page.getByRole("region", { name: "Guided demonstration controls" }),
    ).toBeVisible();
    await expect(
      page.getByText(/not yet in the Formal Topic Pipeline/i).first(),
    ).toBeVisible();
    await page.getByRole("link", { name: "Return to guided demo" }).click();
    await expect(page).toHaveURL(/\/demo\?step=idea-commons/);

    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("link", { name: "Open surcharge discussion" }).click();
    await expect(page).toHaveURL(
      /\/idea-commons\/idea-cedar-surcharge-discussion\?demoStep=proposal/,
    );
    await page
      .getByRole("link", { name: "Continue to 3. Scoping and qualification criteria" })
      .click();
    await expect(page).toHaveURL(
      /\/formal-topics\/cedar-river-drought-surcharge\?demoStep=scoping/,
    );
    await page
      .getByText("Complete gate status and lineage", { exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Gate status and lineage" }),
    ).toBeVisible();

    await page
      .getByRole("link", { name: "Continue to 4. Synthetic Public Input consultation" })
      .click();
    await expect(page).toHaveURL(
      /\/topics\/cedar-river-drought-surcharge\/consult\?demoStep=public-input/,
    );
    await expect(
      page.getByRole("button", { name: "Agree", exact: true }),
    ).toBeVisible();

    await page
      .getByRole("link", { name: "Continue to 5. Submit a statement and cast practice votes" })
      .click();
    await expect(page).toHaveURL(/demoStep=vote/);
    await page.getByRole("button", { name: "Agree", exact: true }).first().click();

    await page
      .getByRole("link", {
        name: "Continue to 6. Anonymous aggregate Public Input report",
      })
      .click();
    await expect(page).toHaveURL(
      /\/formal-topics\/cedar-river-drought-surcharge/,
    );
    await expect(
      page.getByRole("heading", {
        name: "Anonymous aggregate Public Input report",
      }),
    ).toBeVisible();
    await expect(page.getByText(/per-person vote rows/i).first()).toBeVisible();
    await expect(page.getByTestId("opinion-group-suppressed")).toContainText(
      "Suppressed",
    );

    await page
      .getByRole("link", { name: "Continue to 7. Agenda qualification trace" })
      .click();
    await expect(page).toHaveURL(
      /\/agenda\/cedar-river-drought-surcharge\?demoStep=agenda-trace/,
    );
    await expect(
      page.getByRole("heading", { name: "Agenda qualification trace" }),
    ).toBeVisible();

    await page
      .getByRole("link", { name: "Continue to 8. Follow the topic into deliberation" })
      .click();
    await expect(page).toHaveURL(
      /\/deliberation\/cedar-river-drought-surcharge\?demoStep=deliberation/,
    );

    await page
      .getByRole("link", { name: "Continue to 9. Policy recommendation" })
      .click();
    await expect(page).toHaveURL(
      /\/decisions\/cedar-river-drought-surcharge\?demoStep=policy/,
    );

    await page
      .getByRole("link", { name: "Continue to 10. Member action opportunities" })
      .click();
    await expect(page).toHaveURL(
      /\/actions\/cedar-river-drought-surcharge\?demoStep=actions/,
    );
    await expect(
      page.getByRole("heading", { name: "Listed opportunities", exact: true }),
    ).toBeVisible();

    await page
      .getByRole("link", { name: "Continue to 11. Public audit and topic lineage" })
      .click();
    await expect(page).toHaveURL(/\/transparency\?demoStep=audit/);
    await expect(
      page.getByRole("heading", { name: "Topic lineage and trajectories" }),
    ).toBeVisible();

    await page.getByRole("link", { name: "Return to guided demo" }).click();
    await expect(page).toHaveURL(/\/demo\?step=audit/);

    await page.getByRole("button", { name: "Reset", exact: true }).click();
    await expect(
      page.getByRole("heading", {
        name: /Follow an idea from community discussion to collective action/i,
      }),
    ).toBeVisible();
  });
});
