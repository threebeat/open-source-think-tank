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
});
