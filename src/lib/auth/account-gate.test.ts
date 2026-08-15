import { describe, expect, it } from "vitest";

import {
  authenticatedLegacyRedirect,
  hasAuthJsSessionCookie,
  isPublicUnauthenticatedPath,
  unauthenticatedProductRedirect,
} from "@/lib/auth/account-gate";

describe("account gate (V2-21)", () => {
  it("allows landing, demo, about, join, and auth without a session", () => {
    expect(isPublicUnauthenticatedPath("/")).toBe(true);
    expect(isPublicUnauthenticatedPath("/demo")).toBe(true);
    expect(isPublicUnauthenticatedPath("/demo/workflow")).toBe(true);
    expect(isPublicUnauthenticatedPath("/join")).toBe(true);
    expect(isPublicUnauthenticatedPath("/auth/sign-in")).toBe(true);
    expect(isPublicUnauthenticatedPath("/auth/accept")).toBe(true);
    expect(isPublicUnauthenticatedPath("/about")).toBe(true);
    expect(isPublicUnauthenticatedPath("/commons")).toBe(false);
    expect(isPublicUnauthenticatedPath("/account")).toBe(false);
    expect(isPublicUnauthenticatedPath("/idea-commons")).toBe(false);
  });

  it("redirects unauthenticated product URLs to sign-in", () => {
    expect(
      unauthenticatedProductRedirect("/commons", { APP_MODE: "public-demo" }),
    ).toBe("/auth/sign-in");
    expect(
      unauthenticatedProductRedirect("/idea-commons", { APP_MODE: "public-demo" }),
    ).toBe("/auth/sign-in");
    expect(
      unauthenticatedProductRedirect("/workspace/topics", {
        APP_MODE: "public-demo",
      }),
    ).toBeNull();
    expect(
      unauthenticatedProductRedirect("/commons", { APP_MODE: "gated" }),
    ).toBe("/auth/sign-in");
    expect(
      unauthenticatedProductRedirect("/org/ostt-synth-alpha/settings", {
        APP_MODE: "gated",
      }),
    ).toBe("/auth/sign-in");
    expect(unauthenticatedProductRedirect("/demo", { APP_MODE: "gated" })).toBeNull();
    expect(unauthenticatedProductRedirect("/about", { APP_MODE: "gated" })).toBeNull();
    expect(unauthenticatedProductRedirect("/auth/accept", { APP_MODE: "gated" })).toBeNull();
  });

  it("maps authenticated legacy think-tank URLs onto member halls", () => {
    expect(authenticatedLegacyRedirect("/idea-commons")).toBe("/commons");
    expect(authenticatedLegacyRedirect("/idea-commons/thread-1")).toBe("/commons");
    expect(authenticatedLegacyRedirect("/formal-topics")).toBe("/agenda");
    expect(authenticatedLegacyRedirect("/formal-topics/cedar")).toBe(
      "/agenda/topics/cedar",
    );
    expect(
      authenticatedLegacyRedirect("/formal-topics/cedar/consultation/report"),
    ).toBe("/agenda/topics/cedar");
    expect(authenticatedLegacyRedirect("/deliberation/x")).toBe(
      "/chamber/topics/x",
    );
    expect(authenticatedLegacyRedirect("/decisions/x")).toBe("/council/topics/x");
    expect(authenticatedLegacyRedirect("/transparency")).toBe("/records");
    expect(authenticatedLegacyRedirect("/actions/x")).toBe("/records/topics/x");
    expect(authenticatedLegacyRedirect("/about")).toBeNull();
    expect(authenticatedLegacyRedirect("/process")).toBe("/demo");
    expect(authenticatedLegacyRedirect("/demo/workflow")).toBe("/demo");
    expect(authenticatedLegacyRedirect("/topics")).toBe("/agenda");
    expect(authenticatedLegacyRedirect("/topics/ostt-synth-transit")).toBe(
      "/agenda/topics/ostt-synth-transit",
    );
    expect(authenticatedLegacyRedirect("/topics/ostt-synth-transit/consult")).toBe(
      "/agenda/topics/ostt-synth-transit",
    );
    expect(authenticatedLegacyRedirect("/commons")).toBeNull();
  });

  it("detects Auth.js session cookies without treating presence as authorization", () => {
    expect(hasAuthJsSessionCookie("authjs.session-token=abc")).toBe(true);
    expect(hasAuthJsSessionCookie("__Secure-authjs.session-token=abc")).toBe(true);
    expect(hasAuthJsSessionCookie("ch_prealpha_session=abc")).toBe(true);
    expect(hasAuthJsSessionCookie("other=1")).toBe(false);
  });
});
