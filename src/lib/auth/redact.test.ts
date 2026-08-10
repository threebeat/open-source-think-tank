import { describe, expect, it } from "vitest";

import {
  assertNoSecretsInText,
  redactSensitiveFields,
} from "@/lib/auth/redact";

describe("auth redaction", () => {
  it("redacts credential-like keys", () => {
    expect(
      redactSensitiveFields({
        inviteToken: "raw-secret",
        accountId: "account-1",
      }),
    ).toEqual({
      inviteToken: "[redacted]",
      accountId: "account-1",
    });
  });

  it("throws when a raw secret appears in audit text", () => {
    expect(() =>
      assertNoSecretsInText("token=abc", ["abc"]),
    ).toThrow(/raw secret/);
  });
});
