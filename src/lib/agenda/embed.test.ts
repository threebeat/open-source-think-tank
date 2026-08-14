import { describe, expect, it } from "vitest";

import {
  assertNoHostedPolisNetwork,
  cspAllowsPolis,
  hostedPolisUnavailableCopy,
  HOSTED_POLIS_EMBED_SCRIPT,
} from "@/lib/agenda/embed";
import { SECURITY_HEADERS } from "@/lib/security/headers";
import { isHostedPolisEnabled } from "@/lib/v2/flags";

describe("hosted Pol.is remain disabled (V2-11–13)", () => {
  it("never enables hosted Pol.is and never returns a script URL", () => {
    expect(isHostedPolisEnabled()).toBe(false);
    expect(isHostedPolisEnabled({ COMMONHALL_V2_HOSTED_POLIS: "on" })).toBe(
      false,
    );
    const copy = hostedPolisUnavailableCopy();
    expect(copy.hostedPolisEnabled).toBe(false);
    expect(copy.scriptSrc).toBeNull();
    expect(copy.body).toMatch(/no request is made to pol\.is/i);
    expect(HOSTED_POLIS_EMBED_SCRIPT).toBe("https://pol.is/embed.js");
  });

  it("keeps CSP fail-closed for pol.is origins", () => {
    const csp = SECURITY_HEADERS["Content-Security-Policy"] ?? "";
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("connect-src 'self'");
    expect(csp).not.toMatch(/pol\.is/i);
    expect(cspAllowsPolis()).toBe(false);
    expect(() => assertNoHostedPolisNetwork("https://pol.is/embed.js")).toThrow(
      /HOSTED_POLIS_NETWORK_FORBIDDEN/,
    );
    expect(() => assertNoHostedPolisNetwork("https://example.test/app")).not.toThrow();
  });
});
