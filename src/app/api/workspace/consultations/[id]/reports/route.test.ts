import { beforeEach, describe, expect, it, vi } from "vitest";

const requireGatedSession = vi.fn();
const getGatedDb = vi.fn();
const importAggregateReport = vi.fn();
const listStaffReportsForConversation = vi.fn();
const gateAuthenticatedMutation = vi.fn();
const assertCsrfSafe = vi.fn();
const resolveAppMode = vi.fn();

vi.mock("@/lib/env/app-mode", () => ({
  resolveAppMode: () => resolveAppMode(),
}));

vi.mock("@/lib/security/csrf", () => ({
  assertCsrfSafe: (...args: unknown[]) => assertCsrfSafe(...args),
  csrfDeniedResponse: () =>
    Response.json({ error: "CSRF", code: "CSRF_DENIED" }, { status: 403 }),
}));

vi.mock("@/lib/security/mutation-gate", () => ({
  gateAuthenticatedMutation: (...args: unknown[]) =>
    gateAuthenticatedMutation(...args),
}));

vi.mock("@/lib/auth/guard", () => ({
  requireGatedSession: () => requireGatedSession(),
}));

vi.mock("@/lib/auth/runtime", () => ({
  getGatedDb: () => getGatedDb(),
}));

vi.mock("@/lib/public-input/reports/service", () => ({
  importAggregateReport: (...args: unknown[]) => importAggregateReport(...args),
  listStaffReportsForConversation: (...args: unknown[]) =>
    listStaffReportsForConversation(...args),
}));

describe("consultation reports API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveAppMode.mockReturnValue("gated");
    assertCsrfSafe.mockReturnValue(undefined);
    requireGatedSession.mockResolvedValue({
      ok: true,
      session: { accountId: "account-admin" },
    });
    getGatedDb.mockReturnValue({});
    gateAuthenticatedMutation.mockResolvedValue({
      ok: true,
      body: {
        publicTitle: "Title",
        payload: { schemaVersion: "public-input-aggregate-import@1.1" },
      },
    });
  });

  it("returns 404 in public-demo", async () => {
    resolveAppMode.mockReturnValue("public-demo");
    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/api", { method: "POST" }), {
      params: Promise.resolve({ id: "conv-1" }),
    });
    expect(response.status).toBe(404);
  });

  it("imports via consultation_reports family and returns 201", async () => {
    importAggregateReport.mockResolvedValue({
      ok: true,
      value: {
        importId: "imp-1",
        reportId: "rep-1",
        reportVersion: 1,
        isIdempotentReplay: false,
      },
    });
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      }),
      { params: Promise.resolve({ id: "conv-1" }) },
    );
    expect(response.status).toBe(201);
    expect(gateAuthenticatedMutation).toHaveBeenCalledWith(
      expect.objectContaining({ family: "consultation_reports" }),
    );
    expect(importAggregateReport).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        actorAccountId: "account-admin",
        conversationId: "conv-1",
      }),
    );
  });

  it("lists staff reports", async () => {
    listStaffReportsForConversation.mockResolvedValue({
      ok: true,
      value: [{ reportId: "rep-1", version: 1 }],
    });
    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api"), {
      params: Promise.resolve({ id: "conv-1" }),
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { reports: unknown[] };
    expect(body.reports).toHaveLength(1);
  });
});
