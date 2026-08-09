/**
 * Next.js server instrumentation — enforce APP_MODE / secret isolation before
 * any gated database client is constructed (ADR 0002).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") {
    return;
  }
  const { assertEnvironmentSafe } = await import("@/lib/env/app-mode");
  assertEnvironmentSafe();
}