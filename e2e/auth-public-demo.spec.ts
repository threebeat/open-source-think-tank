import { expect, test } from "@playwright/test";

test.describe("auth isolation in public-demo", () => {
  test("account page redirects to sign-in; staff APIs stay 404", async ({ page }) => {
    await page.goto("/account");
    await expect(page).toHaveURL(/\/auth\/sign-in/);

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

    const workspaceSubmissions = await page.request.post(
      "/api/workspace/topics/x/submissions",
      { data: { claimTitle: "demo-should-404" } },
    );
    expect(workspaceSubmissions.status()).toBe(404);

    const ownSubmission = await page.request.patch(
      "/api/workspace/submissions/claim-x",
      { data: { action: "withdraw" } },
    );
    expect(ownSubmission.status()).toBe(404);

    const moderationQueue = await page.request.get("/api/workspace/moderation");
    expect(moderationQueue.status()).toBe(404);
    const moderationClaim = await page.request.post(
      "/api/workspace/moderation/claims/x",
      { data: { action: "hold", publicRationale: "demo-should-404" } },
    );
    expect(moderationClaim.status()).toBe(404);
    const disclosurePatch = await page.request.patch(
      "/api/workspace/disclosures/claims/x",
      { data: { disclosureChoice: "none" } },
    );
    expect(disclosurePatch.status()).toBe(404);

    const enroll = await page.request.post("/api/auth/enroll", {
      data: {
        identifier: "public@ostt.synth.test",
        password: "a-sufficiently-long-pass",
        communityStandardsAssent: true,
        formOpenedAt: Date.now() - 2000,
      },
    });
    expect(enroll.status()).toBe(200);
    expect(JSON.stringify(await enroll.json()).toLowerCase()).not.toMatch(
      /password_hash|scrypt/,
    );

    const passwordSignIn = await page.request.post("/api/auth/password-sign-in", {
      data: {
        identifier: "missing@ostt.synth.test",
        password: "a-sufficiently-long-pass",
      },
    });
    expect(passwordSignIn.status()).toBe(401);
  });

  test("workspace topic and submission pages are not found in public-demo", async ({
    page,
  }) => {
    const response = await page.goto("/workspace/topics");
    expect(response?.status()).toBe(404);
    const submit = await page.goto("/workspace/topics/any/submit");
    expect(submit?.status()).toBe(404);
    const submissions = await page.goto("/workspace/submissions");
    expect(submissions?.status()).toBe(404);
    const moderation = await page.goto("/workspace/moderation");
    expect(moderation?.status()).toBe(404);
    const moderationClaim = await page.goto(
      "/workspace/moderation/claims/claim-ostt-synth-billing-timeline",
    );
    expect(moderationClaim?.status()).toBe(404);
  });

  test("public join shows a working create-account form", async ({ page }) => {
    await page.goto("/join");
    await expect(
      page.getByRole("heading", { name: "Create an account" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /create account/i }),
    ).toBeEnabled();
  });
});
