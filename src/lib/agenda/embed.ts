import { SECURITY_HEADERS } from "@/lib/security/headers";
import { isHostedPolisEnabled } from "@/lib/v2/flags";

export const HOSTED_POLIS_EMBED_SCRIPT = "https://pol.is/embed.js";

export type HostedPolisUnavailableCopy = {
  title: string;
  body: string;
  hostedPolisEnabled: false;
  scriptSrc: null;
};

/**
 * Fail-closed hosted Pol.is surface. Never returns a script URL.
 * CSP already omits pol.is from script-src / connect-src / frame-src.
 */
export function hostedPolisUnavailableCopy(): HostedPolisUnavailableCopy {
  void isHostedPolisEnabled();
  return {
    title: "Hosted Pol.is is unavailable",
    body: "This pre-alpha uses an in-house fixture consultation. Hosted Pol.is is disabled (V2-11–13). No third-party script is loaded, and no request is made to pol.is. Evidence quality is independent of consultation positions.",
    hostedPolisEnabled: false,
    scriptSrc: null,
  };
}

export function cspAllowsPolis(): boolean {
  const csp = SECURITY_HEADERS["Content-Security-Policy"] ?? "";
  return /pol\.is/i.test(csp) || /frame-src/.test(csp);
}

export function assertNoHostedPolisNetwork(url: string): void {
  if (/pol\.is/i.test(url)) {
    throw new Error("HOSTED_POLIS_NETWORK_FORBIDDEN");
  }
}
