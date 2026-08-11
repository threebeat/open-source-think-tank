import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/guard", () => ({
  requireGatedSession: vi.fn(async () => ({
    ok: false,
    status: 401,
    error: "Authentication required",
    code: "AUTH_REQUIRED",
  })),
}));

describe("workspace topic API public-demo isolation", () => {
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

  it("returns 404 for topic APIs in public-demo before gated imports act", async () => {
    process.env.APP_MODE = "public-demo";
    delete process.env.DATABASE_URL;
    delete process.env.AUTH_SECRET;
    delete process.env.OPERATOR_BOOTSTRAP_SECRET;

    const list = await import("@/app/api/workspace/topics/route");
    const get = await list.GET();
    expect(get.status).toBe(404);

    const post = await list.POST(
      new Request("http://localhost/api/workspace/topics", {
        method: "POST",
        headers: {
          origin: "http://evil.example",
          host: "localhost",
          "content-type": "application/json",
        },
        body: "{}",
      }),
    );
    expect(post.status).toBe(404);

    const detail = await import("@/app/api/workspace/topics/[id]/route");
    const detailGet = await detail.GET(
      new Request("http://localhost/api/workspace/topics/x"),
      { params: Promise.resolve({ id: "x" }) },
    );
    expect(detailGet.status).toBe(404);

    const submissions = await import(
      "@/app/api/workspace/topics/[id]/submissions/route"
    );
    const submissionsGet = await submissions.GET(
      new Request("http://localhost/api/workspace/topics/x/submissions"),
      { params: Promise.resolve({ id: "x" }) },
    );
    expect(submissionsGet.status).toBe(404);

    const transition = await import(
      "@/app/api/workspace/topics/[id]/transition/route"
    );
    const transitionPost = await transition.POST(
      new Request("http://localhost/api/workspace/topics/x/transition", {
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
    expect(transitionPost.status).toBe(404);
  });

  it("rejects cross-origin topic create with CSRF in gated mode", async () => {
    process.env.APP_MODE = "gated";
    process.env.DATABASE_URL =
      process.env.DATABASE_URL ??
      "postgres://ostt:ostt@127.0.0.1:54329/ostt_csrf_topics";

    const { POST } = await import("@/app/api/workspace/topics/route");
    const response = await POST(
      new Request("http://localhost/api/workspace/topics", {
        method: "POST",
        headers: {
          origin: "http://evil.example",
          host: "localhost",
          "content-type": "application/json",
        },
        body: JSON.stringify({ slug: "x" }),
      }),
    );
    expect(response.status).toBe(403);
    const body = (await response.json()) as { code?: string };
    expect(body.code).toMatch(/^CSRF_/);
  });
});
