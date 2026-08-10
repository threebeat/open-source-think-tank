import { redirect } from "next/navigation";

import { WithdrawAssentButton } from "@/components/assent/WithdrawAssentButton";
import { DisclosureNotice } from "@/components/DisclosureNotice";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { MainContainer } from "@/components/layout/MainContainer";
import { resolveAppMode } from "@/lib/env/app-mode";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Assent history",
  description:
    "Account-private history of document assent and outcomes (not a legal consent ledger).",
};

export default async function AssentHistoryPage() {
  if (resolveAppMode() !== "gated") {
    redirect("/");
  }

  const { requireGatedSession } = await import("@/lib/auth/guard");
  const gated = await requireGatedSession();
  if (!gated.ok) {
    redirect("/auth/sign-in");
  }

  const { getGatedDb } = await import("@/lib/auth/runtime");
  const {
    listAssentHistoryWithOutcomes,
    mapActiveAccountToApplicableDocuments,
  } = await import("@/lib/assent/status");
  const db = getGatedDb();
  const history = await listAssentHistoryWithOutcomes(
    db,
    gated.session.accountId,
  );
  const applicable = await mapActiveAccountToApplicableDocuments(
    db,
    gated.session.accountId,
  );

  return (
    <MainContainer className="space-y-8">
      <Breadcrumbs
        items={[
          { href: "/", label: "Home" },
          { href: "/account", label: "Account" },
          { label: "Assent history" },
        ]}
      />
      <PageHeader
        eyebrow="Account-private"
        title="Assent history"
        description="Assent records and decline/withdrawal outcomes for this account holder. Withdrawal retains prior assent rows and clears current status."
      />
      <DisclosureNotice title="Retention" tone="caution">
        Withdrawing assent appends an outcome; prior assent rows are retained and
        are not silently erased.
      </DisclosureNotice>

      <section className="space-y-3">
        <h2 className="font-serif text-lg">Applicable published documents</h2>
        {applicable.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No published documents require review.
          </p>
        ) : (
          <ul className="space-y-3">
            {applicable.map((doc) => (
              <li key={doc.documentVersionId} className="text-sm">
                <span className="font-medium">{doc.title}</span>
                {" · "}
                {doc.requiresAssent
                  ? "assent required"
                  : "current assent on file"}
                {" · "}
                <a className="underline" href={doc.reviewPath}>
                  Review full document
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-serif text-lg">History</h2>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">No assent history yet.</p>
        ) : (
          <ul className="space-y-4">
            {history.map((row) =>
              row.entryKind === "assent" ? (
                <li key={row.assentId} className="border-b border-border pb-4">
                  <p className="font-medium">{row.title}</p>
                  <p className="text-sm text-muted-foreground">
                    Assent · {row.kind} · {row.versionLabel} · {row.at}
                  </p>
                  <p className="font-mono text-xs break-all">{row.contentHash}</p>
                  <p className="text-sm">
                    {row.isCurrentPublished
                      ? "Current for published version"
                      : row.wasWithdrawn
                        ? "Withdrawn (prior assent retained)"
                        : `Not current · document state: ${row.documentState}`}
                  </p>
                  {row.isCurrentPublished ? (
                    <WithdrawAssentButton assentId={row.assentId} />
                  ) : null}
                </li>
              ) : (
                <li key={row.outcomeId} className="border-b border-border pb-4">
                  <p className="font-medium">{row.title}</p>
                  <p className="text-sm text-muted-foreground">
                    Outcome: {row.outcome} · {row.kind} · {row.versionLabel} ·{" "}
                    {row.at}
                  </p>
                  {row.reason ? (
                    <p className="text-sm">Reason: {row.reason}</p>
                  ) : null}
                  {row.priorAssentId ? (
                    <p className="font-mono text-xs break-all">
                      prior assent: {row.priorAssentId}
                    </p>
                  ) : null}
                </li>
              ),
            )}
          </ul>
        )}
      </section>
      <p className="text-sm">
        Machine-readable download:{" "}
        <a className="underline" href="/api/assent/history">
          /api/assent/history
        </a>
      </p>
    </MainContainer>
  );
}
