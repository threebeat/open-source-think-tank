import { describe, expect, it } from "vitest";

import {
  assertNoSecretsInText,
  redactSensitiveFields,
} from "@/lib/auth/redact";

describe("auth redaction", () => {
  it("redacts credential-like keys but keeps account ids for audit mode", () => {
    expect(
      redactSensitiveFields({
        inviteToken: "raw-secret",
        accountId: "account-ostt-synth-ada",
      }),
    ).toEqual({
      inviteToken: "[redacted]",
      accountId: "account-ostt-synth-ada",
    });
  });

  it("recursively redacts identifiers for security-log mode", () => {
    expect(
      redactSensitiveFields(
        {
          outer: {
            actorAccountId: "account-ostt-synth-ben",
            email: "ben@ostt.synth.test",
            nested: [{ contactChannel: "x@y.z", ok: 1 }],
            ref: "account-ostt-synth-ada",
          },
        },
        { redactIdentifiers: true },
      ),
    ).toEqual({
      outer: {
        actorAccountId: "[redacted]",
        email: "[redacted]",
        nested: [{ contactChannel: "[redacted]", ok: 1 }],
        ref: "[redacted-id]",
      },
    });
  });

  it("recurses nested objects when redacting secrets only", () => {
    expect(
      redactSensitiveFields({
        outer: { sessionToken: "abc", keep: "yes" },
      }),
    ).toEqual({
      outer: { sessionToken: "[redacted]", keep: "yes" },
    });
  });

  it("throws when a raw secret appears in audit text", () => {
    expect(() =>
      assertNoSecretsInText("token=abc", ["abc"]),
    ).toThrow(/raw secret/);
  });

  it("redacts source URLs, IPs, and private moderation/disclosure fields in security-log mode", () => {
    expect(
      redactSensitiveFields(
        {
          sourceUrl: "https://www.example.com/private",
          clientIp: "203.0.113.9",
          privateDetail: "employer contract",
          privateNotes: "staff-only note",
          verificationArtifact: "ostt:vhold:abc",
          family: "create_submission",
        },
        { redactIdentifiers: true },
      ),
    ).toEqual({
      sourceUrl: "[redacted]",
      clientIp: "[redacted]",
      privateDetail: "[redacted]",
      privateNotes: "[redacted]",
      verificationArtifact: "[redacted]",
      family: "create_submission",
    });
  });
});
