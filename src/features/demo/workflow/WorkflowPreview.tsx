"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  startTransition,
  useMemo,
  useState,
  type ComponentProps,
} from "react";

import { DisclosureNotice } from "@/components/DisclosureNotice";
import { buttonVariants } from "@/components/ui/button";
import { ConflictDisclosureCard } from "@/components/topics/ConflictDisclosureCard";
import { EvidenceComparison } from "@/components/topics/EvidenceComparison";
import { PublicModerationNotice } from "@/components/topics/PublicModerationNotice";
import {
  PublicRevisionSummaryNotice,
  RevisionHistoryPanel,
} from "@/components/topics/RevisionHistoryPanel";
import {
  workflowComparisonFixture,
  workflowDemoDisclosure,
  workflowModerationFixtures,
  workflowParticipantFixture,
  workflowReviewFixture,
  workflowRevisionFixture,
  workflowVisitorFixtures,
} from "@/features/demo/workflow/workflow-fixtures";
import {
  DEFAULT_WORKFLOW_PREVIEW_QUERY,
  MODERATION_PREVIEW_STATES,
  WORKFLOW_VIEWS,
  moderationPreviewStateLabel,
  parseWorkflowPreviewQuery,
  serializeWorkflowPreviewQuery,
  workflowPreviewHref,
  workflowPreviewViewLabel,
  type ModerationPreviewState,
  type WorkflowPreviewQuery,
  type WorkflowPreviewView,
} from "@/features/demo/workflow/workflow-query";
import { cn } from "@/lib/utils";

function usesModerationState(view: WorkflowPreviewView): boolean {
  return view === "moderation" || view === "visitor";
}

export function WorkflowPreview() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlKey = searchParams.toString();
  const urlQuery = useMemo(
    () => parseWorkflowPreviewQuery(new URLSearchParams(urlKey)),
    [urlKey],
  );
  const [query, setQuery] = useState(urlQuery);
  const [syncedUrlKey, setSyncedUrlKey] = useState(urlKey);

  // Sync local selection when the URL changes (refresh / deep link / back).
  if (urlKey !== syncedUrlKey) {
    setSyncedUrlKey(urlKey);
    setQuery(urlQuery);
  }

  function replaceQuery(next: WorkflowPreviewQuery) {
    setQuery(next);
    const params = serializeWorkflowPreviewQuery(next);
    const qs = params.toString();
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  }

  function onViewChange(view: WorkflowPreviewView) {
    replaceQuery({
      view,
      state: usesModerationState(view)
        ? query.state
        : DEFAULT_WORKFLOW_PREVIEW_QUERY.state,
    });
  }

  function onStateChange(state: ModerationPreviewState) {
    replaceQuery({ ...query, state });
  }

  return (
    <div className="space-y-8">
      <DisclosureNotice title="Synthetic demonstration only" tone="caution">
        This feature tour uses fixture snapshots of operational workflow states
        (submission through moderation). It does not perform live moderation,
        write audit events, or connect to a participant datastore.
      </DisclosureNotice>

      <section
        className="space-y-4"
        aria-labelledby="workflow-preview-selector-heading"
        data-testid="workflow-preview-selector"
      >
        <h2
          id="workflow-preview-selector-heading"
          className="font-heading text-xl text-foreground"
        >
          Synthetic preview
        </h2>
        <p className="text-sm text-muted-foreground">
          Choose a fixture snapshot. Selection is stored in the URL so refresh
          keeps the same preview.
        </p>
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap">
          <label className="flex min-w-0 flex-1 flex-col gap-2 text-sm">
            <span className="font-medium text-foreground">Preview view</span>
            <select
              className="min-h-11 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              aria-label="Synthetic preview view"
              value={query.view}
              onChange={(event) =>
                onViewChange(event.target.value as WorkflowPreviewView)
              }
            >
              {WORKFLOW_VIEWS.map((view) => (
                <option key={view} value={view}>
                  {workflowPreviewViewLabel(view)}
                </option>
              ))}
            </select>
          </label>
          {usesModerationState(query.view) ? (
            <label className="flex min-w-0 flex-1 flex-col gap-2 text-sm">
              <span className="font-medium text-foreground">
                Visibility snapshot
              </span>
              <select
                className="min-h-11 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                aria-label="Synthetic moderation state preview"
                value={query.state}
                onChange={(event) =>
                  onStateChange(event.target.value as ModerationPreviewState)
                }
              >
                {MODERATION_PREVIEW_STATES.map((state) => (
                  <option key={state} value={state}>
                    {moderationPreviewStateLabel(state)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground" role="status">
          Showing: {workflowPreviewViewLabel(query.view)}
          {usesModerationState(query.view)
            ? ` · ${moderationPreviewStateLabel(query.state)}`
            : ""}
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href={workflowPreviewHref(DEFAULT_WORKFLOW_PREVIEW_QUERY)}
            className={cn(buttonVariants({ size: "lg", variant: "outline" }))}
          >
            Reset preview defaults
          </Link>
          <Link
            href="/demo"
            className={cn(buttonVariants({ size: "lg", variant: "ghost" }))}
          >
            Back to guided demo
          </Link>
        </div>
      </section>

      <section
        className="space-y-3"
        aria-labelledby="workflow-preview-disclosure-heading"
      >
        <h2
          id="workflow-preview-disclosure-heading"
          className="font-heading text-xl text-foreground"
        >
          What this preview demonstrates
        </h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
          {workflowDemoDisclosure.demonstrates.map((item) => (
            <li key={item} className="break-words">
              {item}
            </li>
          ))}
        </ul>
        <h3 className="font-heading text-lg text-foreground">
          What remains simulated
        </h3>
        <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
          {workflowDemoDisclosure.remainsSimulated.map((item) => (
            <li key={item} className="break-words">
              {item}
            </li>
          ))}
        </ul>
      </section>

      {query.view === "participant" ? <ParticipantSection /> : null}
      {query.view === "review" ? <ReviewSection /> : null}
      {query.view === "revision" ? <RevisionSection /> : null}
      {query.view === "comparison" ? <ComparisonSection /> : null}
      {query.view === "moderation" ? (
        <ModerationSection state={query.state} />
      ) : null}
      {query.view === "visitor" ? <VisitorSection state={query.state} /> : null}
    </div>
  );
}

function ParticipantSection() {
  const fixture = workflowParticipantFixture;
  return (
    <section
      className="space-y-4"
      aria-labelledby="workflow-participant-heading"
      data-testid="workflow-preview-participant"
    >
      <h2
        id="workflow-participant-heading"
        className="font-heading text-xl text-foreground"
      >
        Participant submission & disclosure
      </h2>
      <p className="text-sm font-medium text-foreground">{fixture.roleLabel}</p>
      <div className="space-y-3 text-sm">
        <div>
          <h3 className="font-heading text-lg text-foreground">Claim</h3>
          <p className="mt-1 font-medium text-foreground break-words">
            {fixture.claimTitle}
          </p>
          <p className="mt-1 whitespace-pre-wrap break-words text-muted-foreground">
            {fixture.claimSummary}
          </p>
        </div>
        <div>
          <h3 className="font-heading text-lg text-foreground">
            Linked evidence
          </h3>
          <p className="mt-1 break-words text-foreground">
            {fixture.evidenceTitle}
          </p>
          <p className="text-muted-foreground break-words">
            {fixture.relationship === "supporting"
              ? "Supporting"
              : "Counterevidence"}{" "}
            · {fixture.evidenceOrganization}
          </p>
          <p className="mt-2 whitespace-pre-wrap break-words text-muted-foreground">
            <span className="font-medium text-foreground">Limitations: </span>
            {fixture.limitations}
          </p>
        </div>
      </div>
      <ConflictDisclosureCard
        title="Conflict disclosure (synthetic)"
        publicSummary={fixture.publicConflictSummary}
        privateDetail={fixture.privateConflictDetail}
      />
      <DisclosureNotice title="Private-detail boundary" tone="neutral">
        {fixture.privateDetailBoundaryNote}
      </DisclosureNotice>
    </section>
  );
}

function ReviewSection() {
  const fixture = workflowReviewFixture;
  return (
    <section
      className="space-y-4"
      aria-labelledby="workflow-review-heading"
      data-testid="workflow-preview-review"
    >
      <h2
        id="workflow-review-heading"
        className="font-heading text-xl text-foreground"
      >
        Review decisions
      </h2>
      <p className="text-sm font-medium text-foreground">{fixture.roleLabel}</p>
      <div className="space-y-3 text-sm">
        <div>
          <h3 className="font-heading text-lg text-foreground">
            Claim workflow (independent)
          </h3>
          <p className="mt-1 text-foreground">
            Status:{" "}
            <span className="font-medium">{fixture.claimWorkflowStatus}</span>
          </p>
          <p className="mt-2">
            <span className="font-medium text-foreground">
              Public rationale:{" "}
            </span>
            <span className="whitespace-pre-wrap break-words text-muted-foreground">
              {fixture.claimPublicRationale}
            </span>
          </p>
          <p className="mt-2">
            <span className="font-medium text-foreground">
              {fixture.claimPrivateRationaleLabel}:{" "}
            </span>
            <span className="whitespace-pre-wrap break-words text-muted-foreground">
              {fixture.claimPrivateRationaleNote}
            </span>
          </p>
        </div>
        <div>
          <h3 className="font-heading text-lg text-foreground">
            Evidence quality (independent)
          </h3>
          <p className="mt-1 text-foreground">
            Status:{" "}
            <span className="font-medium">
              {fixture.evidenceQualityStatus}
            </span>
          </p>
          <p className="mt-1 whitespace-pre-wrap break-words text-muted-foreground">
            {fixture.evidenceQualityPlainLanguage}
          </p>
          <p className="mt-2">
            <span className="font-medium text-foreground">
              Quality public rationale:{" "}
            </span>
            <span className="whitespace-pre-wrap break-words text-muted-foreground">
              {fixture.evidenceQualityPublicRationale}
            </span>
          </p>
          <p className="mt-2">
            <span className="font-medium text-foreground">
              Evidence workflow public rationale:{" "}
            </span>
            <span className="whitespace-pre-wrap break-words text-muted-foreground">
              {fixture.evidenceWorkflowPublicRationale}
            </span>
          </p>
        </div>
      </div>
      <DisclosureNotice title="Independence rule" tone="neutral">
        {fixture.independenceNote}
      </DisclosureNotice>
    </section>
  );
}

function RevisionSection() {
  const fixture = workflowRevisionFixture;
  return (
    <section
      className="space-y-4"
      aria-labelledby="workflow-revision-heading"
      data-testid="workflow-preview-revision"
    >
      <h2
        id="workflow-revision-heading"
        className="font-heading text-xl text-foreground"
      >
        Revision chronology
      </h2>
      <p className="text-sm font-medium text-foreground">{fixture.roleLabel}</p>
      <RevisionHistoryPanel
        title={fixture.chronologyTitle}
        history={
          fixture.history as ComponentProps<
            typeof RevisionHistoryPanel
          >["history"]
        }
      />
      <PublicRevisionSummaryNotice
        summary={fixture.publicSummary}
        label="Visitor-safe public summary"
      />
      <DisclosureNotice title="Public summary distinction" tone="neutral">
        {fixture.publicSummaryDistinction}
      </DisclosureNotice>
    </section>
  );
}

function ComparisonSection() {
  const fixture = workflowComparisonFixture;
  return (
    <section
      className="space-y-4"
      aria-labelledby="workflow-comparison-heading"
      data-testid="workflow-preview-comparison"
    >
      <h2
        id="workflow-comparison-heading"
        className="font-heading text-xl text-foreground"
      >
        Evidence comparison
      </h2>
      <p className="text-sm font-medium text-foreground">{fixture.roleLabel}</p>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="min-w-0 space-y-2 text-sm">
          <h3 className="font-heading text-lg text-foreground">
            {fixture.supportingHeading}
          </h3>
          {fixture.items
            .filter((item) => item.relationship === "supporting")
            .map((item) => (
              <p key={item.key} className="break-words text-muted-foreground">
                {item.title} · {item.organization}
              </p>
            ))}
        </div>
        <div className="min-w-0 space-y-2 text-sm">
          <h3 className="font-heading text-lg text-foreground">
            {fixture.counterHeading}
          </h3>
          {fixture.items
            .filter((item) => item.relationship === "counterevidence")
            .map((item) => (
              <p key={item.key} className="break-words text-muted-foreground">
                {item.title} · {item.organization}
              </p>
            ))}
        </div>
      </div>
      <EvidenceComparison
        claimTitle={fixture.claimTitle}
        items={fixture.items}
      />
    </section>
  );
}

function ModerationSection({ state }: { state: ModerationPreviewState }) {
  const fixture = workflowModerationFixtures[state];
  return (
    <section
      className="space-y-4"
      aria-labelledby="workflow-moderation-heading"
      data-testid="workflow-preview-moderation"
    >
      <h2
        id="workflow-moderation-heading"
        className="font-heading text-xl text-foreground"
      >
        Moderation visibility
      </h2>
      <p className="text-sm font-medium text-foreground">{fixture.roleLabel}</p>
      <p
        className="text-sm font-medium text-foreground"
        data-testid="workflow-moderation-state-label"
      >
        {fixture.stateLabel}
      </p>
      <p className="text-sm whitespace-pre-wrap break-words text-muted-foreground">
        {fixture.timelineNote}
      </p>
      {fixture.previewNextStateLabel ? (
        <p className="text-sm text-muted-foreground">
          {fixture.previewNextStateLabel}
        </p>
      ) : null}
      <div className="space-y-2 text-sm">
        <h3 className="font-heading text-lg text-foreground">
          Submission snapshot
        </h3>
        <p className="font-medium text-foreground break-words">
          {fixture.claimTitle}
        </p>
        {fixture.bodyIncluded && fixture.claimSummary ? (
          <p className="whitespace-pre-wrap break-words text-muted-foreground">
            {fixture.claimSummary}
          </p>
        ) : (
          <p className="text-muted-foreground">
            Body withheld in this example state (retained, not deleted).
          </p>
        )}
      </div>
      {fixture.notice ? (
        <PublicModerationNotice
          action={fixture.notice.action}
          publicRationale={fixture.notice.publicRationale}
          recordedAt={fixture.notice.recordedAt}
          subjectKind={fixture.notice.subjectKind}
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          No moderation notice in the visible starting snapshot.
        </p>
      )}
      <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
        <li className="break-words">{fixture.publicRationaleRequired}</li>
        <li className="break-words">{fixture.privateNoteRedactionNote}</li>
        <li className="break-words">{fixture.preservedRevisionHistoryNote}</li>
      </ul>
    </section>
  );
}

function VisitorSection({ state }: { state: ModerationPreviewState }) {
  const fixture = workflowVisitorFixtures[state];
  return (
    <section
      className="space-y-4"
      aria-labelledby="workflow-visitor-heading"
      data-testid="workflow-preview-visitor"
    >
      <h2
        id="workflow-visitor-heading"
        className="font-heading text-xl text-foreground"
      >
        Visitor public projection
      </h2>
      <p className="text-sm font-medium text-foreground">{fixture.roleLabel}</p>
      <p
        className="text-sm font-medium text-foreground"
        data-testid="workflow-visitor-state-label"
      >
        {fixture.stateLabel}
      </p>
      <div className="space-y-2 text-sm">
        <h3 className="font-heading text-lg text-foreground">Topic</h3>
        <p className="break-words text-foreground">{fixture.topicTitle}</p>
      </div>
      {fixture.claimTitle && fixture.claimSummary ? (
        <div className="space-y-2 text-sm">
          <h3 className="font-heading text-lg text-foreground">Published claim</h3>
          <p className="font-medium text-foreground break-words">
            {fixture.claimTitle}
          </p>
          <p className="whitespace-pre-wrap break-words text-muted-foreground">
            {fixture.claimSummary}
          </p>
        </div>
      ) : (
        <DisclosureNotice title="Excluded from this projection" tone="neutral">
          {fixture.bodyExcludedNote}
        </DisclosureNotice>
      )}
      {fixture.publicConflictSummary ? (
        <ConflictDisclosureCard
          title="Public conflict summary"
          publicSummary={fixture.publicConflictSummary}
        />
      ) : null}
      <PublicRevisionSummaryNotice summary={fixture.revisionSummary} />
      {fixture.comparisonItems.length >= 2 ? (
        <EvidenceComparison
          claimTitle={fixture.claimTitle ?? "Synthetic claim"}
          items={fixture.comparisonItems}
        />
      ) : null}
      {fixture.moderationNotice ? (
        <PublicModerationNotice
          action={fixture.moderationNotice.action}
          publicRationale={fixture.moderationNotice.publicRationale}
          recordedAt={fixture.moderationNotice.recordedAt}
          subjectKind={fixture.moderationNotice.subjectKind}
        />
      ) : null}
      <DisclosureNotice title="Projection boundary" tone="neutral">
        {fixture.projectionNote}
      </DisclosureNotice>
    </section>
  );
}
