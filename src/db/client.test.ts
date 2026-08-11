import { afterEach, describe, expect, it, vi } from "vitest";

const original = { ...process.env };

afterEach(() => {
  process.env = { ...original };
  vi.resetModules();
});

describe("createPostgresDb environment isolation", () => {
  it(
    "rejects construction when APP_MODE resolves to public-demo",
    async () => {
      process.env = {
        ...original,
        APP_MODE: "public-demo",
      };
      delete process.env.DATABASE_URL;
      delete process.env.AUTH_SECRET;

      const { createPostgresDb } = await import("@/db/client");

      expect(() =>
        createPostgresDb("postgres://ostt:ostt@127.0.0.1:54329/ostt_dev"),
      ).toThrow(/requires APP_MODE=gated|forbids gated secrets/);
    },
    15_000,
  );

  it("does not construct a client by forcing gated over a public-demo process env", async () => {
    process.env = {
      ...original,
      APP_MODE: "public-demo",
      DATABASE_URL: "postgres://ostt:ostt@127.0.0.1:54329/ostt_dev",
    };

    const { createPostgresDb } = await import("@/db/client");

    expect(() =>
      createPostgresDb(process.env.DATABASE_URL as string),
    ).toThrow(/forbids gated secrets/);
  });
});
