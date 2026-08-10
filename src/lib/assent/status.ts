import { and, eq } from "drizzle-orm";

import { assentOutcomes, assentRecords, documentVersions } from "@/db/schema";
import type { FoundationDb } from "@/db/types";

export type AssentTimelineEntry =
  | {
      kind: "assent";
      at: Date;
      assentId: string;
      documentVersionId: string;
      contentHash: string;
      method: string;
      noticesAcknowledged: string[];
      title: string;
      documentKind: string;
      versionLabel: string;
      documentState: string;
    }
  | {
      kind: "outcome";
      at: Date;
      outcomeId: string;
      outcome: "declined" | "withdrawn";
      documentVersionId: string;
      contentHash: string;
      priorAssentId: string | null;
      reason: string | null;
      title: string;
      documentKind: string;
      versionLabel: string;
      documentState: string;
    };

/** Ordered assent + outcome history for an account (newest last). */
export async function loadAssentTimeline(
  db: FoundationDb,
  accountId: string,
): Promise<AssentTimelineEntry[]> {
  const assents = await db
    .select({
      assent: assentRecords,
      document: documentVersions,
    })
    .from(assentRecords)
    .innerJoin(
      documentVersions,
      eq(assentRecords.documentVersionId, documentVersions.id),
    )
    .where(eq(assentRecords.accountId, accountId));

  const outcomes = await db
    .select({
      outcome: assentOutcomes,
      document: documentVersions,
    })
    .from(assentOutcomes)
    .innerJoin(
      documentVersions,
      eq(assentOutcomes.documentVersionId, documentVersions.id),
    )
    .where(eq(assentOutcomes.accountId, accountId));

  const timeline: AssentTimelineEntry[] = [
    ...assents.map((row) => ({
      kind: "assent" as const,
      at: row.assent.assentedAt,
      assentId: row.assent.id,
      documentVersionId: row.document.id,
      contentHash: row.assent.contentHash,
      method: row.assent.method,
      noticesAcknowledged: row.assent.noticesAcknowledged,
      title: row.document.title,
      documentKind: row.document.kind,
      versionLabel: row.document.versionLabel,
      documentState: row.document.state,
    })),
    ...outcomes.map((row) => ({
      kind: "outcome" as const,
      at: row.outcome.decidedAt,
      outcomeId: row.outcome.id,
      outcome: row.outcome.outcome,
      documentVersionId: row.document.id,
      contentHash: row.outcome.contentHash,
      priorAssentId: row.outcome.priorAssentId,
      reason: row.outcome.reason,
      title: row.document.title,
      documentKind: row.document.kind,
      versionLabel: row.document.versionLabel,
      documentState: row.document.state,
    })),
  ];

  timeline.sort((a, b) => a.at.getTime() - b.at.getTime());
  return timeline;
}

/**
 * Whether the account currently holds effective assent for a published
 * document version. Withdrawal/decline after the latest matching assent
 * clears current status; prior assent rows remain in history.
 */
export function hasCurrentAssentForDocument(
  timeline: AssentTimelineEntry[],
  documentVersionId: string,
  contentHash: string,
): { current: boolean; latestAssentId: string | null; latestAssentedAt: string | null } {
  const relevant = timeline.filter(
    (entry) =>
      entry.documentVersionId === documentVersionId &&
      entry.contentHash === contentHash,
  );

  let latestAssentId: string | null = null;
  let latestAssentedAt: string | null = null;
  let current = false;

  for (const entry of relevant) {
    if (entry.kind === "assent") {
      current = true;
      latestAssentId = entry.assentId;
      latestAssentedAt = entry.at.toISOString();
    } else if (entry.outcome === "withdrawn") {
      if (
        entry.priorAssentId &&
        latestAssentId &&
        entry.priorAssentId === latestAssentId
      ) {
        current = false;
      } else if (!entry.priorAssentId) {
        current = false;
      }
    } else if (entry.outcome === "declined") {
      // Decline does not erase a later assent; it only matters if no later assent.
      // If the latest event is decline, there is no current assent.
      current = false;
    }
  }

  return { current, latestAssentId, latestAssentedAt };
}

export async function listAssentHistoryWithOutcomes(
  db: FoundationDb,
  accountId: string,
) {
  const timeline = await loadAssentTimeline(db, accountId);
  const published = await db
    .select()
    .from(documentVersions)
    .where(eq(documentVersions.state, "published"));

  return timeline
    .slice()
    .reverse()
    .map((entry) => {
      if (entry.kind === "assent") {
        const status = hasCurrentAssentForDocument(
          timeline,
          entry.documentVersionId,
          entry.contentHash,
        );
        const pub = published.find((doc) => doc.id === entry.documentVersionId);
        const wasWithdrawn = timeline.some(
          (event) =>
            event.kind === "outcome" &&
            event.outcome === "withdrawn" &&
            event.priorAssentId === entry.assentId,
        );
        return {
          entryKind: "assent" as const,
          assentId: entry.assentId,
          documentVersionId: entry.documentVersionId,
          kind: entry.documentKind,
          versionLabel: entry.versionLabel,
          title: entry.title,
          contentHash: entry.contentHash,
          method: entry.method,
          at: entry.at.toISOString(),
          noticesAcknowledged: entry.noticesAcknowledged,
          documentState: entry.documentState,
          isCurrentPublished:
            Boolean(pub) &&
            pub!.contentHash === entry.contentHash &&
            status.current &&
            status.latestAssentId === entry.assentId,
          wasWithdrawn,
        };
      }
      return {
        entryKind: "outcome" as const,
        outcomeId: entry.outcomeId,
        outcome: entry.outcome,
        documentVersionId: entry.documentVersionId,
        kind: entry.documentKind,
        versionLabel: entry.versionLabel,
        title: entry.title,
        contentHash: entry.contentHash,
        priorAssentId: entry.priorAssentId,
        reason: entry.reason,
        at: entry.at.toISOString(),
        documentState: entry.documentState,
        isCurrentPublished: false,
      };
    });
}

export async function mapActiveAccountToApplicableDocuments(
  db: FoundationDb,
  accountId: string,
) {
  const published = await db
    .select()
    .from(documentVersions)
    .where(eq(documentVersions.state, "published"));
  const timeline = await loadAssentTimeline(db, accountId);

  return published.map((doc) => {
    const status = hasCurrentAssentForDocument(
      timeline,
      doc.id,
      doc.contentHash,
    );
    return {
      documentVersionId: doc.id,
      kind: doc.kind,
      versionLabel: doc.versionLabel,
      title: doc.title,
      contentHash: doc.contentHash,
      requiredNotices: doc.requiredNotices,
      /** Body is available after presentation is opened — omitted from list payload. */
      requiresAssent: !status.current,
      latestAssentId: status.latestAssentId,
      latestAssentedAt: status.latestAssentedAt,
      reviewPath: `/account/assent/review/${doc.id}`,
    };
  });
}

export async function latestAssentStillCurrent(
  db: FoundationDb,
  accountId: string,
  assentId: string,
): Promise<boolean> {
  const [assent] = await db
    .select()
    .from(assentRecords)
    .where(
      and(eq(assentRecords.id, assentId), eq(assentRecords.accountId, accountId)),
    )
    .limit(1);
  if (!assent) {
    return false;
  }
  const timeline = await loadAssentTimeline(db, accountId);
  const status = hasCurrentAssentForDocument(
    timeline,
    assent.documentVersionId,
    assent.contentHash,
  );
  return status.current && status.latestAssentId === assentId;
}
