import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  assertOrganizationMutationAllowed,
  isChamberLiveEnabled,
  isCouncilLiveEnabled,
  isElevatedPortalEnabled,
  isHostedPolisEnabled,
  isOpenEnrollmentEnabled,
  isSyntheticSeedEnabled,
  isV2KernelEnabled,
  readV2Flags,
} from "@/lib/v2/flags";

const FLAG_KEYS = [
  "APP_MODE",
  "COMMONHALL_V2_KERNEL",
  "COMMONHALL_V2_OPEN_ENROLLMENT",
  "COMMONHALL_SYNTHETIC_SEED",
  "COMMONHALL_V2_HOSTED_POLIS",
  "COMMONHALL_V2_CHAMBER_LIVE",
  "COMMONHALL_V2_COUNCIL_LIVE",
  "COMMONHALL_V2_ELEVATED_PORTAL",
  "DATABASE_URL",
] as const;

const previous: Record<string, string | undefined> = {};

function snapshotEnv() {
  for (const key of FLAG_KEYS) {
    previous[key] = process.env[key];
  }
}

function restoreEnv() {
  for (const key of FLAG_KEYS) {
    const value = previous[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

describe("v2 feature flags", () => {
  beforeEach(() => {
    snapshotEnv();
  });

  afterEach(() => {
    restoreEnv();
  });

  it("enables the kernel only in gated mode and not when killed", () => {
    process.env.APP_MODE = "gated";
    delete process.env.COMMONHALL_V2_KERNEL;
    expect(isV2KernelEnabled()).toBe(true);

    process.env.COMMONHALL_V2_KERNEL = "off";
    expect(isV2KernelEnabled()).toBe(false);

    process.env.COMMONHALL_V2_KERNEL = "on";
    process.env.APP_MODE = "public-demo";
    expect(isV2KernelEnabled()).toBe(false);
  });

  it("enables open enrollment in gated unless the kill switch is off", () => {
    process.env.APP_MODE = "gated";
    delete process.env.COMMONHALL_V2_OPEN_ENROLLMENT;
    expect(isOpenEnrollmentEnabled()).toBe(true);

    process.env.COMMONHALL_V2_OPEN_ENROLLMENT = "on";
    expect(isOpenEnrollmentEnabled()).toBe(true);

    process.env.COMMONHALL_V2_OPEN_ENROLLMENT = "off";
    expect(isOpenEnrollmentEnabled()).toBe(false);

    process.env.COMMONHALL_V2_OPEN_ENROLLMENT = "on";
    process.env.APP_MODE = "public-demo";
    expect(isOpenEnrollmentEnabled()).toBe(false);
  });

  it("enables the synthetic seed catalog in gated unless explicitly off", () => {
    process.env.APP_MODE = "gated";
    delete process.env.COMMONHALL_SYNTHETIC_SEED;
    expect(isSyntheticSeedEnabled()).toBe(true);

    process.env.COMMONHALL_SYNTHETIC_SEED = "on";
    expect(isSyntheticSeedEnabled()).toBe(true);

    process.env.COMMONHALL_SYNTHETIC_SEED = "off";
    expect(isSyntheticSeedEnabled()).toBe(false);

    process.env.COMMONHALL_SYNTHETIC_SEED = "on";
    process.env.APP_MODE = "public-demo";
    expect(isSyntheticSeedEnabled()).toBe(false);

    const flags = readV2Flags();
    expect(flags.syntheticSeed).toBe(false);
  });

  it("fails closed for hosted Pol.is, Chamber, Council, and portal", () => {
    process.env.APP_MODE = "gated";
    process.env.COMMONHALL_V2_HOSTED_POLIS = "on";
    process.env.COMMONHALL_V2_CHAMBER_LIVE = "on";
    process.env.COMMONHALL_V2_COUNCIL_LIVE = "on";
    process.env.COMMONHALL_V2_ELEVATED_PORTAL = "on";

    expect(isHostedPolisEnabled()).toBe(false);
    expect(isChamberLiveEnabled()).toBe(false);
    expect(isCouncilLiveEnabled()).toBe(false);
    expect(isElevatedPortalEnabled()).toBe(false);

    const flags = readV2Flags();
    expect(flags.hostedPolis).toBe(false);
    expect(flags.chamberLive).toBe(false);
    expect(flags.councilLive).toBe(false);
    expect(flags.elevatedPortal).toBe(false);
  });

  it("refuses organization mutation clients in public-demo and when killed", () => {
    process.env.APP_MODE = "public-demo";
    delete process.env.DATABASE_URL;
    expect(() => assertOrganizationMutationAllowed()).toThrow(
      /V2_ORG_MUTATION_FORBIDDEN_PUBLIC_DEMO/,
    );

    process.env.APP_MODE = "gated";
    process.env.DATABASE_URL = "postgres://ostt:ostt@127.0.0.1:54329/ostt_synth";
    process.env.COMMONHALL_V2_KERNEL = "off";
    expect(() => assertOrganizationMutationAllowed()).toThrow(/V2_KERNEL_DISABLED/);

    process.env.COMMONHALL_V2_KERNEL = "on";
    expect(() => assertOrganizationMutationAllowed()).not.toThrow();
  });
});
