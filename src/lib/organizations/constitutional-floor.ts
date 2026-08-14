import type { AdapterResult } from "@/lib/adapters/types";

export const CONSTITUTIONAL_FLOOR_VERSION =
  "commonhall-constitutional-floor@1.0.0";

const NUMERIC_PRODUCTION_KEYS = [
  "consultationThresholds",
  "retention",
  "chamber",
  "council",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isTrue(value: unknown): boolean {
  return value === true;
}

function isFalse(value: unknown): boolean {
  return value === false;
}

/**
 * Non-configurable service floor. Does not invent production numeric defaults
 * (V2-07/08/09/10 remain open). Hosted Pol.is cannot be enabled (V2-11).
 */
export function validateConstitutionalFloor(
  config: unknown,
  options: { synthetic: boolean },
): AdapterResult<Record<string, unknown>> {
  if (!isRecord(config)) {
    return {
      ok: false,
      code: "CONSTITUTIONAL_FLOOR_INVALID",
      error: "Organization config must be an object",
    };
  }

  const missing: string[] = [];
  if (!isTrue(config.communityStandardsRequired)) {
    missing.push("communityStandardsRequired");
  }
  if (!isTrue(config.viewpointNeutralModeration)) {
    missing.push("viewpointNeutralModeration");
  }
  if (!isTrue(config.publicRollCallRequired)) {
    missing.push("publicRollCallRequired");
  }
  if (!isTrue(config.appealsRequired)) {
    missing.push("appealsRequired");
  }
  if (!isTrue(config.recusalRequired)) {
    missing.push("recusalRequired");
  }
  if (!isTrue(config.noSelfElevation)) {
    missing.push("noSelfElevation");
  }
  if (!isTrue(config.tenantIsolation)) {
    missing.push("tenantIsolation");
  }
  if (config.hostedPolisEnabled === true) {
    return {
      ok: false,
      code: "CONSTITUTIONAL_FLOOR_HOSTED_POLIS",
      error:
        "hostedPolisEnabled must be false while V2-11 remains unresolved",
    };
  }
  if (!isFalse(config.hostedPolisEnabled)) {
    missing.push("hostedPolisEnabled=false");
  }

  const privacy = config.privacyFloor;
  if (!isRecord(privacy)) {
    missing.push("privacyFloor");
  } else {
    if (!isFalse(privacy.rawConsultationPublic)) {
      missing.push("privacyFloor.rawConsultationPublic=false");
    }
    if (!isFalse(privacy.individualRecordsPublic)) {
      missing.push("privacyFloor.individualRecordsPublic=false");
    }
  }

  if (missing.length > 0) {
    return {
      ok: false,
      code: "CONSTITUTIONAL_FLOOR_MISSING",
      error: `Constitutional floor missing or false: ${missing.join(", ")}`,
    };
  }

  if (!options.synthetic) {
    const numeric = NUMERIC_PRODUCTION_KEYS.filter((key) => key in config);
    if (numeric.length > 0) {
      return {
        ok: false,
        code: "CONSTITUTIONAL_FLOOR_NUMERIC_OPEN_DECISION",
        error:
          `Non-synthetic config must not set ${numeric.join(", ")} while V2-07/V2-08/V2-09/V2-10 remain open`,
      };
    }
  }

  return { ok: true, value: config };
}

export const SYNTHETIC_CONSTITUTIONAL_CONFIG: Record<string, unknown> = {
  communityStandardsRequired: true,
  viewpointNeutralModeration: true,
  publicRollCallRequired: true,
  appealsRequired: true,
  recusalRequired: true,
  noSelfElevation: true,
  tenantIsolation: true,
  hostedPolisEnabled: false,
  privacyFloor: {
    rawConsultationPublic: false,
    individualRecordsPublic: false,
  },
};
