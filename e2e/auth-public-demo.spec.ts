import { expect, test } from "@playwright/test";

test.describe("auth isolation in public-demo", () => {
  test("account page redirects home and auth APIs 404", async ({ page }) => {
    await page.goto("/account");
    await expect(page).toHaveURL(/\/$/);

    const accept = await page.request.post("/api/auth/accept-invite", {
      data: {
        inviteToken: "ostt-synth-invite-token-cory",
        contactChannel: "cory@ostt.synth.test",
      },
    });
    expect(accept.status()).toBe(404);

    const nextAuth = await page.request.get("/api/auth/session");
    expect(nextAuth.status()).toBe(404);

    const invitationsGet = await page.request.get("/api/staff/invitations");
    expect(invitationsGet.status()).toBe(404);

    const invitationsPost = await page.request.post("/api/staff/invitations", {
      data: { intendedContactChannel: "nobody@example.test" },
    });
    expect(invitationsPost.status()).toBe(404);

    const workspaceTopics = await page.request.get("/api/workspace/topics");
    expect(workspaceTopics.status()).toBe(404);

    const workspaceCreate = await page.request.post("/api/workspace/topics", {
      data: { slug: "demo-should-404" },
    });
    expect(workspaceCreate.status()).toBe(404);
  });

  test("workspace topic pages are not found in public-demo", async ({
    page,
  }) => {
    const response = await page.goto("/workspace/topics");
    expect(response?.status()).toBe(404);
  });

  test("public join preview still cannot enroll", async ({ page }) => {
    await page.goto("/join");
    await expect(
      page.getByText(/does not create an account, issue an invitation/i),
    ).toBeVisible();
    await expect(
      page.getByText(/fixed fixtures, not other current visitors/i),
    ).toBeVisible();
    await page.getByRole("button", { name: /Stronger verification/i }).click();
    await expect(
      page.getByRole("button", { name: "Create account (disabled)" }),
    ).toBeDisabled();
  });
});
