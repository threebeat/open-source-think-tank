import { assertEnvironmentSafe, resolveAppMode, type EnvMap } from "@/lib/env/app-mode";

function envFlag(
  env: EnvMap,
  name: string,
): "on" | "off" | "unset" {
  const raw = env[name]?.trim().toLowerCase();
  if (raw === "on" || raw === "true" || raw === "1") {
    return "on";
  }
  if (raw === "off" || raw === "false" || raw === "0") {
    return "off";
  }
  return "unset";
}

/**
 * Kernel writes are allowed only when APP_MODE=gated and the kill switch is
 * not explicitly off. Default is on in gated environments.
 */
export function isV2KernelEnabled(env: EnvMap = process.env): boolean {
  if (resolveAppMode(env) !== "gated") {
    return false;
  }
  return envFlag(env, "COMMONHALL_V2_KERNEL") !== "off";
}

/** V2-11: hosted Pol.is stays disabled regardless of env. */
export function isHostedPolisEnabled(env: EnvMap = process.env): boolean {
  void env;
  return false;
}

/**
 * Gated open enrollment (Phase 2). Default on in gated unless the kill switch
 * is explicitly off. Public-demo never constructs enrollment/auth clients.
 */
export function isOpenEnrollmentEnabled(env: EnvMap = process.env): boolean {
  if (resolveAppMode(env) !== "gated") {
    return false;
  }
  return envFlag(env, "COMMONHALL_V2_OPEN_ENROLLMENT") !== "off";
}

/**
 * Synthetic Commons/Agenda catalog (Phase 3–4). Default on in gated pre-alpha;
 * always off in public-demo. When off, member list DTOs omit synthetic=true rows.
 * Does not delete rows; operator reset remains the pre-alpha wipe.
 */
export function isSyntheticSeedEnabled(env: EnvMap = process.env): boolean {
  if (resolveAppMode(env) !== "gated") {
    return false;
  }
  return envFlag(env, "COMMONHALL_SYNTHETIC_SEED") !== "off";
}

/**
 * Production live Chamber remains disabled (V2-09). Env cannot enable it.
 * Synthetic fixture playback uses a separate kernel gate on synthetic records.
 */
export function isChamberLiveEnabled(env: EnvMap = process.env): boolean {
  void env;
  return false;
}

/**
 * Production live Council remains disabled (V2-10). Env cannot enable it.
 * Synthetic fixture playback uses a separate kernel gate on synthetic records.
 */
export function isCouncilLiveEnabled(env: EnvMap = process.env): boolean {
  void env;
  return false;
}

/**
 * Phase 5: appointed clerks/members may run Chamber/Council kernel transitions
 * only on labeled synthetic records in gated mode. Not a production policy.
 */
export function isSyntheticBodyPlaybackAllowed(
  env: EnvMap = process.env,
): boolean {
  return isV2KernelEnabled(env);
}

/** Elevated organization portal is Phase 5. */
export function isElevatedPortalEnabled(env: EnvMap = process.env): boolean {
  void env;
  return false;
}

export type V2Flags = {
  kernel: boolean;
  openEnrollment: boolean;
  syntheticSeed: boolean;
  hostedPolis: boolean;
  chamberLive: boolean;
  councilLive: boolean;
  elevatedPortal: boolean;
};

export function readV2Flags(env: EnvMap = process.env): V2Flags {
  return {
    kernel: isV2KernelEnabled(env),
    openEnrollment: isOpenEnrollmentEnabled(env),
    syntheticSeed: isSyntheticSeedEnabled(env),
    hostedPolis: isHostedPolisEnabled(env),
    chamberLive: isChamberLiveEnabled(env),
    councilLive: isCouncilLiveEnabled(env),
    elevatedPortal: isElevatedPortalEnabled(env),
  };
}

/**
 * Public-demo must never construct organization mutation clients.
 * Call before any org/governance write.
 */
export function assertOrganizationMutationAllowed(
  env: EnvMap = process.env,
): void {
  const mode = assertEnvironmentSafe(env);
  if (mode !== "gated") {
    throw new Error("V2_ORG_MUTATION_FORBIDDEN_PUBLIC_DEMO");
  }
  if (!isV2KernelEnabled(env)) {
    throw new Error("V2_KERNEL_DISABLED");
  }
}
