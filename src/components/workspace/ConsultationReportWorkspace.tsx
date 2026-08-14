"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";

import { DisclosureNotice } from "@/components/DisclosureNotice";
import { CANONICAL_IMPORT_SCHEMA_VERSION } from "@/lib/public-input/reports/canonical-schema";
import type { StaffReportDetailDto } from "@/lib/public-input/reports/projection";
import type { StaffReportListItem } from "@/lib/public-input/reports/service";

type Props = {
  conversationId: string;
  topicSlug: string;
  topicTitle: string;
  conversationWorkflowState: string;
  initialReports: StaffReportListItem[];
  canImport: boolean;
  canReview: boolean;
  canPublish: boolean;
  canRecordProviderModeration: boolean;
};

const SAMPLE_PAYLOAD = {
  schemaVersion: CANONICAL_IMPORT_SCHEMA_VERSION,
  sourceKind: "manual_aggregate",
  methodVersion: "public-input-aggregate@4.5.0",
  publicTitle: "Aggregate Public Input report",
  participationCount: 240,
  commentCount: 42,
  voteCount: 1800,
  participationSufficiency:
    "Illustrative coverage for alpha review; not a representativeness claim.",
  representationLimitations:
    "Self-selected participants; not a census or probability sample.",
  opinionGroups: [
    { label: "Group A", participantCount: 149 },
    { label: "Group B", participantCount: 87 },
    { label: "Group C", participantCount: 4 },
  ],
  crossGroupAgreement: [
    "Publish decision criteria before any surcharge applies.",
  ],
  meaningfulDisagreement: ["Graduated surcharge versus flat fee."],
};

export function ConsultationReportWorkspace({
  conversationId,
  topicSlug,
  topicTitle,
  conversationWorkflowState,
  initialReports,
  canImport,
  canReview,
  canPublish,
  canRecordProviderModeration,
}: Props) {
  const router = useRouter();
  const errorId = useId();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [publicTitle, setPublicTitle] = useState(
    `Aggregate report · ${topicTitle}`,
  );
  const [bundleText, setBundleText] = useState(
    JSON.stringify(SAMPLE_PAYLOAD, null, 2),
  );
  const [selectedReportId, setSelectedReportId] = useState<string | null>(
    initialReports[0]?.reportId ?? null,
  );
  const [detail, setDetail] = useState<StaffReportDetailDto | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [providerRef, setProviderRef] = useState("");
  const [providerReason, setProviderReason] = useState("off_topic");
  const [providerStatus, setProviderStatus] = useState<
    "pending" | "accepted" | "rejected"
  >("rejected");
  const [findingRationale, setFindingRationale] = useState("");

  async function loadDetail(reportId: string) {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/workspace/reports/${reportId}`, {
        headers: { accept: "application/json" },
      });
      const data = (await response.json()) as StaffReportDetailDto & {
        error?: string;
      };
      if (!response.ok) {
        setError(data.error ?? "Could not load report detail");
        document.getElementById(errorId)?.focus();
        return;
      }
      setSelectedReportId(reportId);
      setDetail(data);
    } catch {
      setError("Could not load report detail");
      document.getElementById(errorId)?.focus();
    } finally {
      setPending(false);
    }
  }

  async function onImport() {
    setPending(true);
    setError(null);
    try {
      let payload: unknown;
      try {
        payload = JSON.parse(bundleText) as unknown;
      } catch {
        setError("Bundle JSON is not valid JSON");
        document.getElementById(errorId)?.focus();
        return;
      }
      const response = await fetch(
        `/api/workspace/consultations/${conversationId}/reports`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ publicTitle, payload }),
        },
      );
      const data = (await response.json()) as {
        error?: string;
        reportId?: string;
      };
      if (!response.ok) {
        setError(data.error ?? "Import failed");
        document.getElementById(errorId)?.focus();
        return;
      }
      if (data.reportId) {
        await loadDetail(data.reportId);
      }
      router.refresh();
    } catch {
      setError("Import failed");
      document.getElementById(errorId)?.focus();
    } finally {
      setPending(false);
    }
  }

  async function postReportAction(
    path: string,
    body: Record<string, unknown>,
  ): Promise<boolean> {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Action failed");
        document.getElementById(errorId)?.focus();
        return false;
      }
      if (selectedReportId) {
        await loadDetail(selectedReportId);
      }
      router.refresh();
      return true;
    } catch {
      setError("Action failed");
      document.getElementById(errorId)?.focus();
      return false;
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-8" data-testid="consultation-report-workspace">
      <DisclosureNotice title="Aggregate-only ingestion" tone="caution">
        Upload only a prepared aggregate-only canonical JSON bundle. Raw Pol.is
        ZIP/CSV exports must not be uploaded. Recording a provider moderation
        action does not execute it remotely. Moderation cannot change metrics or
        promote a topic. Publication does not qualify the topic for the agenda.
        Live Pol.is remains disabled.
      </DisclosureNotice>

      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="font-medium">Topic</dt>
          <dd className="text-muted-foreground">
            {topicTitle} ({topicSlug})
          </dd>
        </div>
        <div>
          <dt className="font-medium">Conversation workflow</dt>
          <dd className="text-muted-foreground">{conversationWorkflowState}</dd>
        </div>
      </dl>

      {error ? (
        <div
          id={errorId}
          tabIndex={-1}
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </div>
      ) : null}

      {canImport ? (
        <section
          className="space-y-3"
          aria-labelledby="import-aggregate-heading"
        >
          <h2
            id="import-aggregate-heading"
            className="font-heading text-xl text-foreground"
          >
            Import aggregate bundle
          </h2>
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Public title</span>
            <input
              className="min-h-11 w-full rounded-md border border-border bg-background px-3"
              value={publicTitle}
              onChange={(event) => setPublicTitle(event.target.value)}
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Canonical JSON bundle</span>
            <textarea
              className="min-h-48 w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-xs"
              value={bundleText}
              onChange={(event) => setBundleText(event.target.value)}
              spellCheck={false}
              data-testid="aggregate-bundle-input"
            />
          </label>
          <button
            type="button"
            className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
            disabled={pending}
            onClick={() => void onImport()}
            data-testid="import-aggregate-button"
          >
            Import aggregate report
          </button>
        </section>
      ) : null}

      <section className="space-y-3" aria-labelledby="report-history-heading">
        <h2
          id="report-history-heading"
          className="font-heading text-xl text-foreground"
        >
          Version history
        </h2>
        {initialReports.length === 0 ? (
          <p className="text-sm text-muted-foreground">No imports yet.</p>
        ) : (
          <ul className="space-y-2" data-testid="report-history-list">
            {initialReports.map((report) => (
              <li key={report.reportId}>
                <button
                  type="button"
                  className="min-h-11 w-full rounded-md border border-border px-3 py-2 text-left text-sm hover:bg-muted"
                  onClick={() => void loadDetail(report.reportId)}
                  data-testid="report-history-item"
                >
                  v{report.version} · {report.workflowState}
                  {report.isLatestPublished ? " · latest published" : ""}
                  {report.supersededByReportId ? " · superseded" : ""}
                  {" · "}
                  {report.publicTitle}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {detail ? (
        <section
          className="space-y-4"
          aria-labelledby="report-detail-heading"
          data-testid="report-detail"
        >
          <h2
            id="report-detail-heading"
            className="font-heading text-xl text-foreground"
          >
            Review · v{detail.version} ({detail.workflowState})
          </h2>
          <p className="text-sm text-muted-foreground">
            Importer and publisher account ids are recorded for provenance.
            When they are the same account, this alpha does not claim
            independent review.
          </p>
          <p className="text-xs text-muted-foreground font-mono">
            importer={detail.importerAccountId ?? "n/a"} · publisher=
            {detail.publisherAccountId ?? "n/a"} · same=
            {detail.importerAccountId &&
            detail.publisherAccountId &&
            detail.importerAccountId === detail.publisherAccountId
              ? "yes"
              : "no"}
          </p>

          <div>
            <h3 className="font-heading text-lg text-foreground">
              Group cells (staff exact counts / raw shares)
            </h3>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              {detail.groups.map((group) => (
                <li key={group.id} data-testid="staff-group-cell">
                  {group.label}: n={group.participantCount} · raw{" "}
                  {(group.rawShare * 100).toFixed(1)}% · published{" "}
                  {group.publishedStatus}
                  {group.publishedShare != null
                    ? ` (${(group.publishedShare * 100).toFixed(1)}%)`
                    : ""}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-heading text-lg text-foreground">
              Finding publication decisions
            </h3>
            <ul className="mt-2 space-y-3">
              {detail.findings.map((finding) => (
                <li
                  key={finding.id}
                  className="rounded-md border border-border px-3 py-3 text-sm"
                  data-testid="staff-finding-row"
                >
                  <p className="font-medium text-foreground">
                    {finding.kind} · {finding.publicationStatus}
                  </p>
                  <p className="mt-1 text-muted-foreground whitespace-pre-wrap">
                    {finding.statementText}
                  </p>
                  {canReview && detail.workflowState === "under_review" ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="min-h-11 rounded-md border border-border px-3"
                        disabled={pending}
                        onClick={() =>
                          void postReportAction(
                            `/api/workspace/reports/${detail.reportId}/findings/${finding.id}/decision`,
                            {
                              action: "include",
                              expectedConcurrencyVersion:
                                detail.concurrencyVersion,
                            },
                          )
                        }
                      >
                        Include
                      </button>
                      <button
                        type="button"
                        className="min-h-11 rounded-md border border-border px-3"
                        disabled={pending}
                        onClick={() =>
                          void postReportAction(
                            `/api/workspace/reports/${detail.reportId}/findings/${finding.id}/decision`,
                            {
                              action: "withhold",
                              expectedConcurrencyVersion:
                                detail.concurrencyVersion,
                              publicRationale:
                                findingRationale ||
                                "Withheld pending institutional review rationale.",
                            },
                          )
                        }
                      >
                        Withhold
                      </button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
            {canReview ? (
              <label className="mt-3 block space-y-1 text-sm">
                <span className="font-medium">
                  Public rationale for withhold/supersede
                </span>
                <input
                  className="min-h-11 w-full rounded-md border border-border bg-background px-3"
                  value={findingRationale}
                  onChange={(event) => setFindingRationale(event.target.value)}
                />
              </label>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            {canImport && detail.workflowState === "imported" ? (
              <button
                type="button"
                className="min-h-11 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
                disabled={pending}
                data-testid="validate-report-button"
                onClick={() =>
                  void postReportAction(
                    `/api/workspace/reports/${detail.reportId}/validate`,
                    {
                      expectedConcurrencyVersion: detail.concurrencyVersion,
                    },
                  )
                }
              >
                Mark validated
              </button>
            ) : null}
            {canReview && detail.workflowState === "validated" ? (
              <button
                type="button"
                className="min-h-11 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
                disabled={pending}
                data-testid="begin-review-button"
                onClick={() =>
                  void postReportAction(
                    `/api/workspace/reports/${detail.reportId}/review`,
                    {
                      expectedConcurrencyVersion: detail.concurrencyVersion,
                    },
                  )
                }
              >
                Begin review
              </button>
            ) : null}
            {canPublish && detail.workflowState === "under_review" ? (
              <button
                type="button"
                className="min-h-11 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
                disabled={pending}
                data-testid="publish-report-button"
                onClick={() =>
                  void postReportAction(
                    `/api/workspace/reports/${detail.reportId}/publish`,
                    {
                      expectedConcurrencyVersion: detail.concurrencyVersion,
                    },
                  )
                }
              >
                Publish report
              </button>
            ) : null}
            {canReview &&
            (detail.workflowState === "validated" ||
              detail.workflowState === "under_review") ? (
              <div className="flex w-full flex-wrap items-end gap-2">
                <label className="block min-w-[16rem] flex-1 space-y-1 text-sm">
                  <span className="font-medium">Reject reason</span>
                  <input
                    className="min-h-11 w-full rounded-md border border-border bg-background px-3"
                    value={rejectReason}
                    onChange={(event) => setRejectReason(event.target.value)}
                  />
                </label>
                <button
                  type="button"
                  className="min-h-11 rounded-md border border-destructive/40 px-4 text-sm text-destructive disabled:opacity-50"
                  disabled={pending}
                  data-testid="reject-report-button"
                  onClick={() =>
                    void postReportAction(
                      `/api/workspace/reports/${detail.reportId}/reject`,
                      {
                        expectedConcurrencyVersion: detail.concurrencyVersion,
                        reason: rejectReason,
                      },
                    )
                  }
                >
                  Reject version
                </button>
              </div>
            ) : null}
          </div>

          <div
            className="rounded-md border border-dashed border-border px-4 py-4"
            data-testid="public-preview"
          >
            <h3 className="font-heading text-lg text-foreground">
              Public projection preview notes
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Published pages show only allowlisted aggregates after
              complementary small-cell suppression. Staff raw shares above are
              never sent to public routes. Draft/import/review states return
              generic not-found outside this workspace.
            </p>
          </div>
        </section>
      ) : null}

      {canRecordProviderModeration ? (
        <section
          className="space-y-3"
          aria-labelledby="provider-moderation-heading"
        >
          <h2
            id="provider-moderation-heading"
            className="font-heading text-xl text-foreground"
          >
            Record provider-side moderation metadata
          </h2>
          <p className="text-sm text-muted-foreground">
            Observational only. This does not call Pol.is and must not include
            rejected statement text — use an opaque fingerprint/reference.
          </p>
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Opaque statement reference</span>
            <input
              className="min-h-11 w-full rounded-md border border-border bg-background px-3 font-mono text-xs"
              value={providerRef}
              onChange={(event) => setProviderRef(event.target.value)}
              data-testid="provider-moderation-ref"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1 text-sm">
              <span className="font-medium">Status</span>
              <select
                className="min-h-11 w-full rounded-md border border-border bg-background px-3"
                value={providerStatus}
                onChange={(event) =>
                  setProviderStatus(
                    event.target.value as "pending" | "accepted" | "rejected",
                  )
                }
              >
                <option value="pending">pending</option>
                <option value="accepted">accepted</option>
                <option value="rejected">rejected</option>
              </select>
            </label>
            <label className="block space-y-1 text-sm">
              <span className="font-medium">Reason code</span>
              <input
                className="min-h-11 w-full rounded-md border border-border bg-background px-3"
                value={providerReason}
                onChange={(event) => setProviderReason(event.target.value)}
              />
            </label>
          </div>
          <button
            type="button"
            className="inline-flex min-h-11 items-center rounded-md border border-border px-4 text-sm font-medium disabled:opacity-50"
            disabled={pending}
            data-testid="record-provider-moderation-button"
            onClick={() =>
              void postReportAction(
                `/api/workspace/consultations/${conversationId}/provider-moderation`,
                {
                  opaqueStatementRef: providerRef,
                  status: providerStatus,
                  reasonCode: providerReason,
                },
              )
            }
          >
            Record provider moderation
          </button>
        </section>
      ) : null}
    </div>
  );
}
