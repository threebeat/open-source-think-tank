import { describe, expect, it } from "vitest";

import {
  addLocalPost,
  encodeAccountsCookie,
  encodeSessionCookie,
  enrollLocalAccount,
  hasPreAlphaSessionCookie,
  PRE_ALPHA_SESSION_COOKIE,
  readLocalAccounts,
  readLocalSession,
  signInLocalAccount,
} from "@/lib/auth/pre-alpha-local";

describe("pre-alpha local browser auth", () => {
  it("enrolls, signs in, and rejects a wrong password", async () => {
    const enrolled = await enrollLocalAccount([], {
      identifier: "maya@ostt.synth.test",
      password: "a-sufficiently-long-pass",
      communityStandardsAssent: true,
      formOpenedAt: Date.now() - 2000,
    });
    expect(enrolled.ok).toBe(true);
    if (!enrolled.ok) {
      return;
    }
    const cookie = encodeAccountsCookie(enrolled.accounts);
    const restored = readLocalAccounts(cookie);
    expect(restored).toHaveLength(1);
    expect(JSON.stringify(restored[0])).not.toMatch(/a-sufficiently-long-pass/);

    const session = readLocalSession(
      encodeSessionCookie(enrolled.session),
      cookie,
    );
    expect(session?.accountId).toBe(enrolled.session.accountId);

    const signedIn = await signInLocalAccount(
      enrolled.accounts,
      "maya@ostt.synth.test",
      "a-sufficiently-long-pass",
    );
    expect(signedIn.ok).toBe(true);

    const rejected = await signInLocalAccount(
      enrolled.accounts,
      "maya@ostt.synth.test",
      "totally-wrong-password",
    );
    expect(rejected.ok).toBe(false);
  });

  it("detects the pre-alpha session cookie without treating it as authorization", () => {
    expect(hasPreAlphaSessionCookie(`${PRE_ALPHA_SESSION_COOKIE}=abc`)).toBe(true);
    expect(hasPreAlphaSessionCookie("other=1")).toBe(false);
  });

  it("stores a member post on the local account", async () => {
    const enrolled = await enrollLocalAccount([], {
      identifier: "jordan@ostt.synth.test",
      password: "a-sufficiently-long-pass",
      communityStandardsAssent: true,
      formOpenedAt: Date.now() - 2000,
    });
    expect(enrolled.ok).toBe(true);
    if (!enrolled.ok) {
      return;
    }
    const posted = addLocalPost(enrolled.accounts, enrolled.session.accountId, {
      title: "Lighting on the last two blocks",
      body: "This should show up in Informal Commons after sign-in.",
      category: "general_discussion",
    });
    expect(posted.ok).toBe(true);
    if (!posted.ok) {
      return;
    }
    expect(posted.accounts[0]?.posts[0]?.title).toMatch(/Lighting/);
  });
});
