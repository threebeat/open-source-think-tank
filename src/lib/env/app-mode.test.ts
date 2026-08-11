import { afterEach, describe, expect, it } from "vitest";

import {
  assertEnvironmentSafe,
  listPresentGatedSecrets,
  resolveAppMode,
} from "@/lib/env/app-mode";

const original = { ...process.env };

afterEach(() => {
  process.env = { ...original };
});

describe("resolveAppMode", () => {
  it("defaults unset APP_MODE to public-demo", () => {
    delete process.env.APP_MODE;
    expect(resolveAppMode(process.env)).toBe("public-demo");
  });

  it("accepts gated and public-demo", () => {
    expect(resolveAppMode({ APP_MODE: "gated" })).toBe("gated");
    expect(resolveAppMode({ APP_MODE: "public-demo" })).toBe("public-demo");
  });

  it("rejects unknown modes", () => {
    expect(() => resolveAppMode({ APP_MODE: "production" })).toThrow(
      /Invalid APP_MODE/,
    );
  });
});

describe("assertEnvironmentSafe", () => {
  it("fails when public-demo has DATABASE_URL", () => {
    expect(() =>
      assertEnvironmentSafe({
        APP_MODE: "public-demo",
        DATABASE_URL: "postgres://local/ostt",
      }),
    ).toThrow(/forbids gated secrets/);
  });

  it("fails when public-demo has AUTH_SECRET even if APP_MODE unset", () => {
    expect(() =>
      assertEnvironmentSafe({
        AUTH_SECRET: "not-a-real-secret",
      }),
    ).toThrow(/AUTH_SECRET/);
  });

  it("fails when public-demo has OPERATOR_BOOTSTRAP_SECRET", () => {
    expect(() =>
      assertEnvironmentSafe({
        APP_MODE: "public-demo",
        OPERATOR_BOOTSTRAP_SECRET: "ostt-synth-operator-bootstrap-secret-32chars!!",
      }),
    ).toThrow(/OPERATOR_BOOTSTRAP_SECRET/);
  });

  it("fails when gated mode lacks DATABASE_URL", () => {
    expect(() => assertEnvironmentSafe({ APP_MODE: "gated" })).toThrow(
      /requires DATABASE_URL/,
    );
  });

  it("allows gated mode with DATABASE_URL", () => {
    expect(
      assertEnvironmentSafe({
        APP_MODE: "gated",
        DATABASE_URL: "postgres://localhost:5432/ostt_dev",
      }),
    ).toBe("gated");
  });

  it("allows public-demo with no gated secrets", () => {
    expect(assertEnvironmentSafe({ APP_MODE: "public-demo" })).toBe(
      "public-demo",
    );
    expect(listPresentGatedSecrets({ APP_MODE: "public-demo" })).toEqual([]);
  });
});
