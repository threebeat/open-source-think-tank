import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { POST } from "@/app/api/auth/enroll/route";

const FLAG_KEYS = ["APP_MODE", "DATABASE_URL", "AUTH_SECRET"] as const;

describe("enroll API isolation", () => {
  const previous: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of FLAG_KEYS) {
      previous[key] = process.env[key];
    }
  });

  afterEach(() => {
    for (const key of FLAG_KEYS) {
      const value = previous[key];
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it("does not construct enrollment in public-demo", async () => {
    process.env.APP_MODE = "public-demo";
    delete process.env.DATABASE_URL;
    delete process.env.AUTH_SECRET;
    const response = await POST(
      new Request("http://127.0.0.1/api/auth/enroll", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          identifier: "public@ostt.synth.test",
          password: "a-sufficiently-long-pass",
          communityStandardsAssent: true,
          formOpenedAt: Date.now() - 2000,
        }),
      }),
    );
    expect(response.status).toBe(404);
  });
});
