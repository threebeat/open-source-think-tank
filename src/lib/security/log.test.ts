import { afterEach, describe, expect, it, vi } from "vitest";

import { operationalSubjectRef, securityLog } from "@/lib/security/log";

describe("securityLog", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("emits opaque subject refs and redacted nested details", () => {
    process.env.AUTH_SECRET = "ostt-synth-log-test-secret";
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    const subjectRef = operationalSubjectRef("account-ostt-synth-ada");
    expect(subjectRef.startsWith("subj_")).toBe(true);
    expect(subjectRef).not.toContain("account-ostt");

    securityLog({
      level: "info",
      event: "privacy.test_event",
      subjectRef,
      details: {
        actorAccountId: "account-ostt-synth-ben",
        nested: { email: "ben@ostt.synth.test" },
        workflow: "account_request",
      },
    });

    expect(info).toHaveBeenCalledTimes(1);
    const line = String(info.mock.calls[0]?.[0]);
    expect(line).toContain(subjectRef);
    expect(line).not.toContain("account-ostt-synth");
    expect(line).not.toContain("@ostt.synth.test");
    expect(line).toContain("account_request");
    expect(line).toContain("[redacted]");
  });

  it("rejects raw account ids in subjectRef", () => {
    expect(() =>
      securityLog({
        level: "info",
        event: "privacy.test_event",
        subjectRef: "account-ostt-synth-ada",
      }),
    ).toThrow(/operationalSubjectRef/);
  });

  it("redacts invite tokens, verification artifacts, raw URLs, and IPs in details", () => {
    process.env.AUTH_SECRET = "ostt-synth-log-test-secret";
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    securityLog({
      level: "warn",
      event: "mutation.rate_limited",
      subjectRef: operationalSubjectRef("account-ostt-synth-ada"),
      details: {
        inviteToken: "raw-invite-token-SENTINEL-9f3a",
        challengeToken: "raw-challenge-token-SENTINEL-9f3a",
        verificationArtifact: "ostt:vhold:SENTINEL-artifact",
        sourceUrl: "https://www.example.com/private/path?secret=1",
        clientIp: "203.0.113.44",
        family: "create_submission",
        limit: 8,
        retryAfterSeconds: 12,
      },
    });

    const line = String(warn.mock.calls[0]?.[0] ?? "");
    expect(line).toContain("mutation.rate_limited");
    expect(line).not.toContain("raw-invite-token-SENTINEL-9f3a");
    expect(line).not.toContain("raw-challenge-token-SENTINEL-9f3a");
    expect(line).not.toContain("ostt:vhold:SENTINEL-artifact");
    expect(line).not.toContain("https://www.example.com/private/path");
    expect(line).not.toContain("203.0.113.44");
    expect(line).not.toContain("account-ostt-synth-ada");
    expect(line).toContain("create_submission");
  });
});
