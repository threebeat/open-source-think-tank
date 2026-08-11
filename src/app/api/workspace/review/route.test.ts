import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/guard", () => ({
  requireGatedSession: vi.fn(async () => ({
    ok: false,
    status: 401,
    error: "Authentication required",
    code: "AUTH_REQUIRED",
  })),
}));

describe("review and publish API public-demo isolation", () => {
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

  it("returns 404 for review/publish APIs before gated imports act", async () => {
    process.env.APP_MODE = "public-demo";
    delete process.env.DATABASE_URL;
    delete process.env.AUTH_SECRET;
    delete process.env.OPERATOR_BOOTSTRAP_SECRET;

    const claims = await import("@/app/api/workspace/review/claims/route");
    const claimsGet = await claims.GET(
      new Request("http://localhost/api/workspace/review/claims"),
    );
    expect(claimsGet.status).toBe(404);

    const claimDetail = await import(
      "@/app/api/workspace/review/claims/[id]/route"
    );
    const claimPost = await claimDetail.POST(
      new Request("http://localhost/api/workspace/review/claims/x", {
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

    const evidence = await import("@/app/api/workspace/review/evidence/route");
    const evidenceGet = await evidence.GET(
      new Request("http://localhost/api/workspace/review/evidence"),
    );
    expect(evidenceGet.status).toBe(404);

    const evidenceDetail = await import(
      "@/app/api/workspace/review/evidence/[id]/route"
    );
    const evidencePost = await evidenceDetail.POST(
      new Request("http://localhost/api/workspace/review/evidence/x", {
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

    const publish = await import(
      "@/app/api/workspace/topics/[id]/publish/route"
    );
    const publishPost = await publish.POST(
      new Request("http://localhost/api/workspace/topics/x/publish", {
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
    expect(publishPost.status).toBe(404);
  });
});

describe("public topics page import isolation (source)", () => {
  it("keeps gated DB modules behind dynamic import in /topics pages", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const list = readFileSync(
      join(process.cwd(), "src/app/topics/page.tsx"),
      "utf8",
    );
    const detail = readFileSync(
      join(process.cwd(), "src/app/topics/[slug]/page.tsx"),
      "utf8",
    );
    expect(list).not.toMatch(
      /import\s+.*from\s+["']@\/lib\/topics\/gated-public-read["']/,
    );
    expect(list).not.toMatch(
      /import\s+.*from\s+["']@\/lib\/auth\/runtime["']/,
    );
    expect(detail).not.toMatch(
      /import\s+.*from\s+["']@\/lib\/topics\/gated-public-read["']/,
    );
    expect(detail).not.toMatch(
      /import\s+.*from\s+["']@\/lib\/auth\/runtime["']/,
    );
    expect(list).toMatch(/import\(\s*["']\.\/gated-published-topics["']\s*\)/);
    expect(detail).toMatch(
      /import\(\s*["']\.\.\/gated-published-topic-detail["']\s*\)/,
    );
  });
});
