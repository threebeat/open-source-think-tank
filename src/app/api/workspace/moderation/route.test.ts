import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/guard", () => ({
  requireGatedSession: vi.fn(async () => ({
    ok: false,
    status: 401,
    error: "Authentication required",
    code: "AUTH_REQUIRED",
  })),
}));

describe("moderation and disclosure API public-demo isolation", () => {
  let previousMode: string | undefined;

  beforeEach(() => {
    previousMode = process.env.APP_MODE;
  });

  afterEach(() => {
    vi.resetModules();
    if (previousMode === undefined) {
      delete process.env.APP_MODE;
    } else {
      process.env.APP_MODE = previousMode;
    }
  });

  it("returns 404 for moderation/disclosure APIs before gated imports act", async () => {
    process.env.APP_MODE = "public-demo";
    delete process.env.DATABASE_URL;
    delete process.env.AUTH_SECRET;
    delete process.env.OPERATOR_BOOTSTRAP_SECRET;

    const queue = await import("@/app/api/workspace/moderation/route");
    const queueGet = await queue.GET();
    expect(queueGet.status).toBe(404);

    const claimDetail =
      await import("@/app/api/workspace/moderation/claims/[id]/route");
    const claimGet = await claimDetail.GET(
      new Request("http://localhost/api/workspace/moderation/claims/x"),
      { params: Promise.resolve({ id: "x" }) },
    );
    expect(claimGet.status).toBe(404);
    const claimPost = await claimDetail.POST(
      new Request("http://localhost/api/workspace/moderation/claims/x", {
        method: "POST",
        headers: {
          origin: "http://evil.example",
          host: "localhost",
          "content-type": "application/json",
        },
        body: "{}",
      }),
      { params: Promise.resolve({ id: "x" }) },
    );
    expect(claimPost.status).toBe(404);

    const evidenceDetail =
      await import("@/app/api/workspace/moderation/evidence/[id]/route");
    const evidenceGet = await evidenceDetail.GET(
      new Request("http://localhost/api/workspace/moderation/evidence/x"),
      { params: Promise.resolve({ id: "x" }) },
    );
    expect(evidenceGet.status).toBe(404);
    const evidencePost = await evidenceDetail.POST(
      new Request("http://localhost/api/workspace/moderation/evidence/x", {
        method: "POST",
        headers: {
          origin: "http://evil.example",
          host: "localhost",
          "content-type": "application/json",
        },
        body: "{}",
      }),
      { params: Promise.resolve({ id: "x" }) },
    );
    expect(evidencePost.status).toBe(404);

    const claimDisclosure =
      await import("@/app/api/workspace/disclosures/claims/[id]/route");
    const claimDisclosureGet = await claimDisclosure.GET(
      new Request("http://localhost/api/workspace/disclosures/claims/x"),
      { params: Promise.resolve({ id: "x" }) },
    );
    expect(claimDisclosureGet.status).toBe(404);
    const claimDisclosurePatch = await claimDisclosure.PATCH(
      new Request("http://localhost/api/workspace/disclosures/claims/x", {
        method: "PATCH",
        headers: {
          origin: "http://evil.example",
          host: "localhost",
          "content-type": "application/json",
        },
        body: "{}",
      }),
      { params: Promise.resolve({ id: "x" }) },
    );
    expect(claimDisclosurePatch.status).toBe(404);

    const evidenceDisclosure =
      await import("@/app/api/workspace/disclosures/evidence/[id]/route");
    const evidenceDisclosureGet = await evidenceDisclosure.GET(
      new Request("http://localhost/api/workspace/disclosures/evidence/x"),
      { params: Promise.resolve({ id: "x" }) },
    );
    expect(evidenceDisclosureGet.status).toBe(404);
    const evidenceDisclosurePatch = await evidenceDisclosure.PATCH(
      new Request("http://localhost/api/workspace/disclosures/evidence/x", {
        method: "PATCH",
        headers: {
          origin: "http://evil.example",
          host: "localhost",
          "content-type": "application/json",
        },
        body: "{}",
      }),
      { params: Promise.resolve({ id: "x" }) },
    );
    expect(evidenceDisclosurePatch.status).toBe(404);
  });
});
