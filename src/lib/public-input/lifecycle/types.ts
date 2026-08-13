import type {
  ConversationRecord,
  PublicInputProviderAvailability,
  PublicInputProviderKind,
  PublicInputWorkflowState,
} from "@/lib/public-input/lifecycle/repository";

/**
 * Visitor/participant-safe projection. NEVER add `providerConversationRef`,
 * internal `id`, `createdByAccountId`, or `lastTransitionByAccountId` here —
 * see docs/phase-4-plan.md §7 (privacy contract) and the CRITICAL CONSTRAINTS
 * for Phase 4.3: provider conversation references must never appear in
 * public DTOs, URLs, or logs.
 */
export type PublicConsultationView = {
  topicId: string;
  workflowState: PublicInputWorkflowState;
  providerAvailability: PublicInputProviderAvailability;
  publicTitle: string;
  publicPrompt: string;
  opensAt: string | null;
  closesAt: string | null;
  configurationVersion: number;
};

/** Draft conversations are staff-only; they have no public projection yet. */
const PUBLICLY_VISIBLE_STATES: ReadonlySet<PublicInputWorkflowState> = new Set([
  "ready",
  "open",
  "commenting_closed",
  "voting_closed",
  "closed",
  "archived",
]);

export function toPublicConsultationView(
  record: ConversationRecord,
): PublicConsultationView | null {
  if (record.designation !== "current") {
    return null;
  }
  if (!PUBLICLY_VISIBLE_STATES.has(record.workflowState)) {
    return null;
  }
  return {
    topicId: record.topicId,
    workflowState: record.workflowState,
    providerAvailability: record.providerAvailability,
    publicTitle: record.publicTitle,
    publicPrompt: record.publicPrompt,
    opensAt: record.opensAt ? record.opensAt.toISOString() : null,
    closesAt: record.closesAt ? record.closesAt.toISOString() : null,
    configurationVersion: record.configurationVersion,
  };
}

/**
 * Staff-facing summary. Still omits the raw provider ref — staff who need to
 * rotate/remove a mapping call the dedicated service functions, which never
 * return the ref value either. `hasProviderMapping` is a boolean signal only.
 */
export type StaffConsultationSummary = {
  conversationId: string;
  topicId: string;
  workflowState: PublicInputWorkflowState;
  providerAvailability: PublicInputProviderAvailability;
  providerKind: PublicInputProviderKind;
  hasProviderMapping: boolean;
  publicTitle: string;
  publicPrompt: string;
  configurationVersion: number;
  opensAt: string | null;
  closesAt: string | null;
  version: number;
  designation: ConversationRecord["designation"];
  synthetic: boolean;
  createdAt: string;
  updatedAt: string;
};

export function toStaffConsultationSummary(
  record: ConversationRecord,
): StaffConsultationSummary {
  return {
    conversationId: record.id,
    topicId: record.topicId,
    workflowState: record.workflowState,
    providerAvailability: record.providerAvailability,
    providerKind: record.providerKind,
    hasProviderMapping: Boolean(record.providerConversationRef),
    publicTitle: record.publicTitle,
    publicPrompt: record.publicPrompt,
    configurationVersion: record.configurationVersion,
    opensAt: record.opensAt ? record.opensAt.toISOString() : null,
    closesAt: record.closesAt ? record.closesAt.toISOString() : null,
    version: record.version,
    designation: record.designation,
    synthetic: record.synthetic,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

/** Defense-in-depth: fails a test/build if either DTO shape ever grows the ref field. */
export function assertNoProviderRefLeak(value: object): void {
  if ("providerConversationRef" in value) {
    throw new Error(
      "PUBLIC_INPUT_DTO_LEAK: providerConversationRef must never appear on a public/staff DTO",
    );
  }
}
