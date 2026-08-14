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

/** Open enrollment is Phase 2; Phase 1 stays invite-only. */
export function isOpenEnrollmentEnabled(env: EnvMap = process.env): boolean {
  void env;
  return false;
}

/** Live Chamber product is Phase 4; appointments may persist. */
export function isChamberLiveEnabled(env: EnvMap = process.env): boolean {
  void env;
  return false;
}

/** Live organization Council product is Phase 4. */
export function isCouncilLiveEnabled(env: EnvMap = process.env): boolean {
  void env;
  return false;
}

/** Elevated organization portal is Phase 5. */
export function isElevatedPortalEnabled(env: EnvMap = process.env): boolean {
  void env;
  return false;
}

export type V2Flags = {
  kernel: boolean;
  openEnrollment: boolean;
  hostedPolis: boolean;
  chamberLive: boolean;
  councilLive: boolean;
  elevatedPortal: boolean;
};

export function readV2Flags(env: EnvMap = process.env): V2Flags {
  return {
    kernel: isV2KernelEnabled(env),
    openEnrollment: isOpenEnrollmentEnabled(env),
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
