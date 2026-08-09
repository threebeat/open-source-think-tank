import { expect, test } from "@playwright/test";

test.describe("simulated consultation", () => {
  test("collects local votes and opens the fixed synthetic report", async ({
    page,
  }) => {
    await page.goto("/topics/cedar-river-drought-surcharge/consult");
    await expect(
      page.getByText(/not a live Pol\.is conversation/i),
    ).toBeVisible();

    const voteGroup = page.getByRole("group", {
      name: "Respond to this statement",
    });
    const agree = voteGroup.getByRole("button", { name: "Agree", exact: true });
    await agree.focus();
    await expect(agree).toBeFocused();
    await page.keyboard.press("Enter");
    await voteGroup
      .getByRole("button", { name: "Disagree", exact: true })
      .click();
    await voteGroup.getByRole("button", { name: "Pass", exact: true }).click();

    await page.getByRole("button", { name: "Open synthetic report" }).click();
    const report = page.getByRole("region", {
      name: "Fixed synthetic consultation report",
    });
    await expect(report).toBeVisible();
    await expect(
      report.getByText("Group A, Group B, Group C", { exact: true }),
    ).toBeVisible();
    await expect(
      report.getByText("Not a representative sample", { exact: true }),
    ).toBeVisible();
    await expect(
      report.getByText("Consensus is not proof", { exact: true }),
    ).toBeVisible();
  });
});


