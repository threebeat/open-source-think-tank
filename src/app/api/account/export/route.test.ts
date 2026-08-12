import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const requireGatedSession = vi.fn();
const exportOwnAccountData = vi.fn();

vi.mock("@/lib/auth/guard", () => ({
  requireGatedSession: () => requireGatedSession(),
}));

vi.mock("@/lib/auth/runtime", () => ({
  getGatedDb: vi.fn(() => ({})),
}));

vi.mock("@/lib/privacy/export", () => ({
  exportOwnAccountData: (...args: unknown[]) => exportOwnAccountData(...args),
}));

describe("GET /api/account/export", () => {
  let previousMode: string | undefined;

  beforeEach(() => {
    previousMode = process.env.APP_MODE;
    process.env.APP_MODE = "gated";
    requireGatedSession.mockReset();
    exportOwnAccountData.mockReset();
  });

  afterEach(() => {
    vi.resetModules();
    if (previousMode === undefined) {
      delete process.env.APP_MODE;
    } else {
      process.env.APP_MODE = previousMode;
    }
  });

  it("sets no-store and download headers on a successful export", async () => {
    requireGatedSession.mockResolvedValue({
      ok: true,
      session: { accountId: "account-ostt-synth-ada" },
    });
    exportOwnAccountData.mockResolvedValue({
      ok: true,
      value: {
        accountId: "account-ostt-synth-ada",
        notice: "provisional",
      },
    });

    const { GET } = await import("@/app/api/account/export/route");
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Content-Disposition")).toBe(
      'attachment; filename="ostt-account-export.json"',
    );
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("returns generic not-found with no-store in public-demo", async () => {
    process.env.APP_MODE = "public-demo";
    const { GET } = await import("@/app/api/account/export/route");
    const response = await GET();
    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(exportOwnAccountData).not.toHaveBeenCalled();
  });
});
