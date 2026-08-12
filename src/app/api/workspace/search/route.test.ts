import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const requireGatedSession = vi.fn();
const searchWorkspace = vi.fn();
const getGatedDb = vi.fn(() => ({ __mockDb: true }));

vi.mock("@/lib/auth/guard", () => ({
  requireGatedSession: () => requireGatedSession(),
}));

vi.mock("@/lib/auth/runtime", () => ({
  getGatedDb: () => getGatedDb(),
}));

vi.mock("@/lib/search/workspace-search", () => ({
  searchWorkspace: (...args: unknown[]) => searchWorkspace(...args),
}));

describe("GET /api/workspace/search", () => {
  let previousMode: string | undefined;

  beforeEach(() => {
    previousMode = process.env.APP_MODE;
    process.env.APP_MODE = "gated";
    requireGatedSession.mockReset();
    searchWorkspace.mockReset();
    getGatedDb.mockClear();
  });

  afterEach(() => {
    vi.resetModules();
    if (previousMode === undefined) {
      delete process.env.APP_MODE;
    } else {
      process.env.APP_MODE = previousMode;
    }
  });

  it("returns generic not-found with no-store in public-demo and skips services", async () => {
    process.env.APP_MODE = "public-demo";
    const { GET } = await import("@/app/api/workspace/search/route");
    const response = await GET(
      new Request("http://localhost/api/workspace/search?q=billing"),
    );
    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(requireGatedSession).not.toHaveBeenCalled();
    expect(searchWorkspace).not.toHaveBeenCalled();
    expect(getGatedDb).not.toHaveBeenCalled();
  });

  it("returns unauthenticated with no-store", async () => {
    requireGatedSession.mockResolvedValue({
      ok: false,
      status: 401,
      error: "Authentication required",
      code: "AUTH_REQUIRED",
    });
    const { GET } = await import("@/app/api/workspace/search/route");
    const response = await GET(
      new Request("http://localhost/api/workspace/search?q=billing"),
    );
    expect(response.status).toBe(401);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(searchWorkspace).not.toHaveBeenCalled();
  });

  it("sets no-store on a successful search", async () => {
    requireGatedSession.mockResolvedValue({
      ok: true,
      session: { accountId: "account-ostt-synth-ada" },
    });
    searchWorkspace.mockResolvedValue({
      ok: true,
      value: {
        query: "billing",
        entities: ["claims"],
        page: 1,
        pageSize: 20,
        total: 0,
        results: [],
      },
    });
    const { GET } = await import("@/app/api/workspace/search/route");
    const response = await GET(
      new Request(
        "http://localhost/api/workspace/search?q=billing&entities=claims",
      ),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(searchWorkspace).toHaveBeenCalled();
  });
});
