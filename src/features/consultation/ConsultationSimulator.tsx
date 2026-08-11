"use client";

import { useEffect, useId, useMemo, useState } from "react";

import { DisclosureNotice } from "@/components/DisclosureNotice";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { ConsultationResults } from "@/features/consultation/ConsultationResults";
import { StatementRelationships } from "@/features/consultation/StatementRelationships";
import { MIN_RESPONSES_TO_OPEN_REPORT } from "@/features/consultation/consultation-storage";
import { useConsultationVotes } from "@/features/consultation/useConsultationVotes";
import type {
  Claim,
  ConsultationResult,
  ConsultationStatement,
  EvidenceSource,
  OpinionGroup,
} from "@/domain/types";
import type { ConsultationVote } from "@/features/consultation/consultation-storage";

type ConsultationSimulatorProps = {
  topicId: string;
  topicSlug: string;
  topicTitle: string;
  statements: ConsultationStatement[];
  result: ConsultationResult | null;
  groups: OpinionGroup[];
  claims: Claim[];
  evidenceSources: EvidenceSource[];
};

function buildAnnouncement(
  statements: ConsultationStatement[],
  nextIndex: number,
  responseCount: number,
  vote: ConsultationVote,
): string {
  const next = statements[nextIndex];
  if (!next) {
    return `Recorded ${vote}. Progress: ${responseCount} of ${statements.length} answered locally.`;
  }
  return `Recorded ${vote}. Now viewing statement ${nextIndex + 1} of ${statements.length}. ${next.text} Progress: ${responseCount} of ${statements.length} answered locally.`;
}

export function ConsultationSimulator({
  topicId,
  topicSlug,
  topicTitle,
  statements,
  result,
  groups,
  claims,
  evidenceSources,
}: ConsultationSimulatorProps) {
  const progressId = useId();
  const { votes, persist, reset: resetVotes } = useConsultationVotes(topicId);
  const [index, setIndex] = useState(0);
  const [showReport, setShowReport] = useState(false);
  const [liveStatus, setLiveStatus] = useState("");
  const [hashStatementId, setHashStatementId] = useState<string | null>(null);

  const responseCount = Object.keys(votes).length;
  const hashUnlocksReport =
    hashStatementId != null &&
    statements.some((statement) => statement.id === hashStatementId);
  const canOpenReport =
    Boolean(result) &&
    (responseCount >= MIN_RESPONSES_TO_OPEN_REPORT || hashUnlocksReport);
  const safeIndex = Math.min(index, Math.max(statements.length - 1, 0));
  const current = statements[safeIndex];
  const claimsById = useMemo(
    () => new Map(claims.map((claim) => [claim.id, claim])),
    [claims],
  );
  const evidenceById = useMemo(
    () => new Map(evidenceSources.map((source) => [source.id, source])),
    [evidenceSources],
  );

  useEffect(() => {
    function syncHash() {
      const id = window.location.hash.replace(/^#/, "");
      if (id && statements.some((statement) => statement.id === id)) {
        setHashStatementId(id);
        setShowReport(true);
      }
    }
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, [statements]);

  useEffect(() => {
    if (!showReport || !hashStatementId) {
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(hashStatementId)?.scrollIntoView({
        block: "start",
        behavior: "smooth",
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [showReport, hashStatementId]);

  function vote(value: ConsultationVote) {
    if (!current) {
      return;
    }
    const nextVotes = { ...votes, [current.id]: value };
    persist(nextVotes);
    const nextCount = Object.keys(nextVotes).length;
    if (safeIndex < statements.length - 1) {
      const nextIndex = safeIndex + 1;
      setIndex(nextIndex);
      setLiveStatus(
        buildAnnouncement(statements, nextIndex, nextCount, value),
      );
    } else {
      setLiveStatus(
        `Recorded ${value}. Progress: ${nextCount} of ${statements.length} answered locally. End of statement list.`,
      );
    }
  }

  function reset() {
    resetVotes();
    setIndex(0);
    setShowReport(false);
    setLiveStatus(
      "Local responses cleared. Progress: 0 answered. Showing the first statement again.",
    );
  }

  if (!result || statements.length === 0) {
    return (
      <EmptyState
        title="Public input not open for this topic"
        description={`${topicTitle} does not yet have a sealed synthetic consultation snapshot. Earlier-stage topics intentionally stop before this step.`}
      />
    );
  }

  return (
    <div className="space-y-8">
      <DisclosureNotice title="Simulated consultation — not Pol.is">
        This screen imitates the role of a Pol.is-style statement vote for the
        demonstration. It is not a live Pol.is conversation, does not call any
        Pol.is service, and does not send your practice responses anywhere.
      </DisclosureNotice>

      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="outline" size="lg" onClick={reset}>
          Reset local responses
        </Button>
        <Button
          type="button"
          size="lg"
          disabled={!canOpenReport}
          onClick={() => setShowReport(true)}
          aria-describedby={canOpenReport ? undefined : "report-unlock-help"}
        >
          Open synthetic report
        </Button>
      </div>
      {!canOpenReport ? (
        <p id="report-unlock-help" className="text-sm text-muted-foreground">
          Respond to at least {MIN_RESPONSES_TO_OPEN_REPORT} statements to unlock
          the fixed synthetic report. Your answers stay in this browser session
          only.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Local practice responses: {responseCount} of {statements.length}. The
          report content remains the sealed fixture and is not personalized.
        </p>
      )}

      <p
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        aria-label="Public input practice updates"
      >
        {liveStatus}
      </p>

      {!showReport ? (
        <section
          className="rounded-md border border-border bg-surface p-5 sm:p-6"
          aria-labelledby="statement-heading"
        >
          <div className="space-y-2">
            <p className="text-xs font-medium tracking-wide text-primary uppercase">
              Statement practice
            </p>
            <div
              className="h-2 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-labelledby={progressId}
              aria-valuemin={0}
              aria-valuemax={statements.length}
              aria-valuenow={responseCount}
              aria-valuetext={`${responseCount} of ${statements.length} statements answered locally`}
            >
              <div
                className="h-full bg-primary transition-[width]"
                style={{
                  width: `${(responseCount / statements.length) * 100}%`,
                }}
              />
            </div>
            <p id={progressId} className="text-sm text-muted-foreground">
              Progress: {responseCount} of {statements.length} answered locally.
              Viewing statement {safeIndex + 1} of {statements.length}.
            </p>
          </div>

          <h2
            id="statement-heading"
            className="mt-6 font-heading text-2xl text-foreground"
          >
            {current?.text}
          </h2>
          {current && votes[current.id] ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Your local response: {votes[current.id]}. Choosing again will
              overwrite it in session storage only.
            </p>
          ) : null}

          {current ? (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-medium text-foreground">
                Related claims and evidence
              </p>
              <StatementRelationships
                statement={current}
                topicSlug={topicSlug}
                claimsById={claimsById}
                evidenceById={evidenceById}
              />
            </div>
          ) : null}

          <div
            className="mt-6 flex flex-wrap gap-3"
            role="group"
            aria-label="Respond to this statement"
          >
            <Button
              type="button"
              size="lg"
              onClick={() => vote("agree")}
              aria-pressed={current ? votes[current.id] === "agree" : false}
            >
              Agree
            </Button>
            <Button
              type="button"
              size="lg"
              variant="outline"
              onClick={() => vote("disagree")}
              aria-pressed={current ? votes[current.id] === "disagree" : false}
            >
              Disagree
            </Button>
            <Button
              type="button"
              size="lg"
              variant="secondary"
              onClick={() => vote("pass")}
              aria-pressed={current ? votes[current.id] === "pass" : false}
            >
              Pass
            </Button>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <Button
              type="button"
              variant="ghost"
              size="lg"
              disabled={safeIndex === 0}
              onClick={() => setIndex((value) => Math.max(0, value - 1))}
            >
              Previous statement
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="lg"
              disabled={safeIndex >= statements.length - 1}
              onClick={() =>
                setIndex((value) => Math.min(statements.length - 1, value + 1))
              }
            >
              Next statement
            </Button>
          </div>
        </section>
      ) : (
        <div className="space-y-4">
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() => setShowReport(false)}
          >
            Back to statement practice
          </Button>
          <ConsultationResults
            topicSlug={topicSlug}
            result={result}
            statements={statements}
            groups={groups}
            claimsById={claimsById}
            evidenceById={evidenceById}
          />
        </div>
      )}
    </div>
  );
}
