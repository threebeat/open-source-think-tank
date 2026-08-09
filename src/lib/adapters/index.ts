export type { AppMode, AccountLifecycleState, AdapterResult } from "@/lib/adapters/types";
export type {
  PersistenceAdapter,
  PersistenceHealth,
  TransactionContext,
} from "@/lib/adapters/persistence";
export { PublicDemoPersistenceAdapter } from "@/lib/adapters/persistence";
export {
  assertEnvironmentSafe,
  resolveAppMode,
  GATED_SECRET_ENV_KEYS,
} from "@/lib/env/app-mode";
export type { AuthAdapter, AuthSession } from "@/lib/adapters/auth";
export { PublicDemoAuthAdapter } from "@/lib/adapters/auth";
export type { EmailAdapter, EmailMessage } from "@/lib/adapters/email";
export { NoopEmailAdapter } from "@/lib/adapters/email";
export type { VerificationAdapter } from "@/lib/adapters/verification";
export { StubVerificationAdapter } from "@/lib/adapters/verification";
export type { AuditPublishAdapter } from "@/lib/adapters/audit-publish";
export { InMemoryDeniedAuditAdapter } from "@/lib/adapters/audit-publish";
export type {
  ConsultationParticipationAdapter,
} from "@/lib/adapters/consultation-participation";
export {
  ForbiddenConsultationParticipationAdapter,
} from "@/lib/adapters/consultation-participation";

import { PublicDemoAuthAdapter } from "@/lib/adapters/auth";
import { InMemoryDeniedAuditAdapter } from "@/lib/adapters/audit-publish";
import { ForbiddenConsultationParticipationAdapter } from "@/lib/adapters/consultation-participation";
import { NoopEmailAdapter } from "@/lib/adapters/email";
import { PublicDemoPersistenceAdapter } from "@/lib/adapters/persistence";
import { StubVerificationAdapter } from "@/lib/adapters/verification";
import type { AppMode } from "@/lib/adapters/types";

/** Resolve safe public-demo adapters. Gated implementations arrive in 2.3–2.4. */
export function createPublicDemoAdapters() {
  return {
    mode: "public-demo" as AppMode,
    persistence: new PublicDemoPersistenceAdapter(),
    auth: new PublicDemoAuthAdapter(),
    email: new NoopEmailAdapter(),
    verification: new StubVerificationAdapter(),
    auditPublish: new InMemoryDeniedAuditAdapter(),
    consultationParticipation: new ForbiddenConsultationParticipationAdapter(),
  };
}
