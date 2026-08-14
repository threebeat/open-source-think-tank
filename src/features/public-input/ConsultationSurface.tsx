import Link from "next/link";

import { DisclosureNotice } from "@/components/DisclosureNotice";
import type { PublicConsultationView } from "@/lib/public-input/lifecycle/types";
import type {
  PublicInputProviderAvailability,
  PublicInputWorkflowState,
} from "@/lib/public-input/lifecycle/repository";
import { LIVE_PUBLIC_INPUT_ACTIVATION_GATES } from "@/lib/public-input/lifecycle/activation";

export type ConsultationSurfaceProps = {
  topicSlug: string;
  topicTitle: string;
  consultation: PublicConsultationView | null;
  /** When null, conversation is not configured for this topic. */
  lane: "gated" | "public-demo";
  /** Sanitized operational note for provider/embed failures (never raw refs). */
  operationalNote?: string | null;
};

const WORKFLOW_LABELS: Record<PublicInputWorkflowState, string> = {
  draft: "Draft (staff only)",
  ready: "Ready — not yet open",
  open: "Open for comments and votes",
  commenting_closed: "Commenting closed — voting still open",
  voting_closed: "Voting closed",
  closed: "Closed",
  archived: "Archived",
};

const AVAILABILITY_LABELS: Record<PublicInputProviderAvailability, string> = {
  not_configured: "Provider not configured",
  available: "Provider available",
  degraded: "Provider degraded",
  unavailable: "Provider unavailable",
};

function participantCanDo(state: PublicInputWorkflowState | null): string {
  switch (state) {
    case "ready":
      return "You can review the consultation prompt. Participation opens when administrators move the consultation to Open.";
    case "open":
      return "When a live provider is authorized, eligible participants may comment and vote. Live provider activation remains blocked.";
    case "commenting_closed":
      return "New comments are closed. Voting may still be available when a live provider is authorized.";
    case "voting_closed":
      return "Commenting and voting are closed. Results remain for institutional review.";
    case "closed":
      return "This consultation is closed. Prefer the topic overview and published records.";
    case "archived":
      return "This consultation is archived for historical reference only.";
    default:
      return "No current consultation is configured for this topic.";
  }
}

/**
 * Gated participant-facing consultation surface.
 * Never loads a live iframe, provider script, or provider asset.
 */
export function ConsultationSurface({
  topicSlug,
  topicTitle,
  consultation,
  lane,
  operationalNote = null,
}: ConsultationSurfaceProps) {
  const workflowState = consultation?.workflowState ?? null;
  const availability = consultation?.providerAvailability ?? "not_configured";
  const unresolvedGateCount = LIVE_PUBLIC_INPUT_ACTIVATION_GATES.filter(
    (gate) => gate.status !== "resolved",
  ).length;

  return (
    <section
      className="space-y-6"
      aria-labelledby="consultation-surface-heading"
      data-testid="consultation-surface"
      data-workflow-state={workflowState ?? "not_configured"}
      data-provider-availability={availability}
    >
      <div className="space-y-2">
        <h2
          id="consultation-surface-heading"
          className="font-heading text-2xl text-foreground"
        >
          {consultation?.publicTitle ?? `Public Input · ${topicTitle}`}
        </h2>
        <p className="text-sm text-muted-foreground">
          Institutional consultation for{" "}
          <span className="font-medium text-foreground">{topicTitle}</span>.
        </p>
      </div>

      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="font-medium text-foreground">Institutional state</dt>
          <dd className="mt-1 text-muted-foreground">
            {workflowState
              ? WORKFLOW_LABELS[workflowState]
              : "Not configured"}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-foreground">Provider availability</dt>
          <dd className="mt-1 text-muted-foreground">
            {AVAILABILITY_LABELS[availability]}
          </dd>
        </div>
        {consultation?.opensAt ? (
          <div>
            <dt className="font-medium text-foreground">Opens</dt>
            <dd className="mt-1 text-muted-foreground">
              <time dateTime={consultation.opensAt}>{consultation.opensAt}</time>
            </dd>
          </div>
        ) : null}
        {consultation?.closesAt ? (
          <div>
            <dt className="font-medium text-foreground">Closes</dt>
            <dd className="mt-1 text-muted-foreground">
              <time dateTime={consultation.closesAt}>
                {consultation.closesAt}
              </time>
            </dd>
          </div>
        ) : null}
      </dl>

      <DisclosureNotice title="What you can do now" tone="neutral">
        {participantCanDo(workflowState)}
      </DisclosureNotice>

      <DisclosureNotice title="Anonymous participation" tone="caution">
        Intended Public Input participation is conversation-scoped and
        pseudonymous. This alpha does not send identity-linking parameters
        (including xid). Preference signals stay separate from evidence quality.
      </DisclosureNotice>

      {consultation?.publicPrompt ? (
        <div className="space-y-2">
          <h3 className="font-heading text-lg text-foreground">Prompt</h3>
          <p className="text-sm leading-6 text-muted-foreground whitespace-pre-wrap">
            {consultation.publicPrompt}
          </p>
        </div>
      ) : null}

      <EmbedBoundaryPlaceholder
        lane={lane}
        workflowState={workflowState}
        availability={availability}
        unresolvedGateCount={unresolvedGateCount}
        operationalNote={operationalNote}
      />

      <p className="flex flex-wrap gap-4 text-sm">
        <Link
          href={`/agenda/topics/${topicSlug}`}
          className="text-primary underline underline-offset-2"
        >
          Back to topic overview
        </Link>
        <Link
          href={`/agenda/topics/${topicSlug}`}
          className="text-primary underline underline-offset-2"
          data-testid="consultation-report-link"
        >
          Published aggregate report
        </Link>
        <Link
          href={`/agenda/topics/${topicSlug}?tab=discussion`}
          className="text-primary underline underline-offset-2"
        >
          Discussions &amp; proposals
        </Link>
      </p>
    </section>
  );
}

function EmbedBoundaryPlaceholder({
  lane,
  workflowState,
  availability,
  unresolvedGateCount,
  operationalNote,
}: {
  lane: "gated" | "public-demo";
  workflowState: PublicInputWorkflowState | null;
  availability: PublicInputProviderAvailability;
  unresolvedGateCount: number;
  operationalNote: string | null;
}) {
  let title = "Live embed disabled";
  let body =
    "The provider embed shell is fail-closed. No iframe, provider script, or provider asset is loaded.";

  if (lane === "public-demo" && !workflowState) {
    title = "Public-demo uses fixtures only";
    body =
      "Public-demo never loads a live iframe, provider script, provider API, or provider asset. Practice Public Input remains synthetic.";
  } else if (!workflowState) {
    title = "Consultation not configured";
    body =
      "No current institutional conversation is registered for this topic. The canonical topic page remains available.";
  } else if (workflowState === "ready") {
    title = "Ready — embed remains closed";
    body =
      "The consultation is institutionally ready but not open. The embed stays disabled until open and every live activation gate is cleared.";
  } else if (workflowState === "archived") {
    title = "Archived consultation";
    body =
      "Historical consultations do not load a live provider surface. Use published records and topic lineage.";
  } else if (availability === "degraded") {
    title = "Provider degraded";
    body =
      "Institutional workflow state is unchanged. A sanitized operational note may be recorded; the embed stays disabled.";
  } else if (availability === "unavailable") {
    title = "Provider unavailable";
    body =
      "Provider outage does not alter institutional workflow state. Participate via institutional fallback messaging only.";
  } else if (
    workflowState === "open" ||
    workflowState === "commenting_closed"
  ) {
    title = "Open institutionally — live provider blocked";
    body = `Live Pol.is activation remains blocked (${unresolvedGateCount} unresolved gate(s)). The disabled embed shell preserves the security boundary.`;
  }

  if (lane === "public-demo") {
    body = `${body} Public-demo never loads a live iframe, provider script, provider API, or provider asset.`;
  }

  return (
    <div
      className="space-y-3 rounded-md border border-dashed border-border bg-surface-muted p-5"
      data-testid="embed-boundary-placeholder"
      role="status"
    >
      <h3 className="font-heading text-lg text-foreground">{title}</h3>
      <p className="text-sm text-muted-foreground">{body}</p>
      {operationalNote ? (
        <p className="text-xs text-muted-foreground">
          Operational note: {operationalNote}
        </p>
      ) : null}
      <p className="text-xs text-muted-foreground">
        Exact-origin URL construction, CSP frame-src changes, and iframe sandbox
        policy are defined for a future authorized activation — not enabled here.
      </p>
    </div>
  );
}
