import { redirect } from "next/navigation";

import { DisclosureNotice } from "@/components/DisclosureNotice";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { MainContainer } from "@/components/layout/MainContainer";
import { resolveAppMode } from "@/lib/env/app-mode";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Assent history",
  description:
    "Account-private history of document assent records (not a legal consent ledger).",
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
  const { listAssentHistory } = await import("@/lib/assent/record-assent");
  const history = await listAssentHistory(getGatedDb(), gated.session.accountId);

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
        description="Records of document assent for this account holder. This page uses assent vocabulary and does not characterize every privacy processing basis as consent."
      />
      <DisclosureNotice title="Retention" tone="caution">
        Withdrawing assent appends a withdrawal outcome; prior assent rows are
        retained and are not silently erased.
      </DisclosureNotice>
      {history.length === 0 ? (
        <p className="text-sm text-muted-foreground">No assent records yet.</p>
      ) : (
        <ul className="space-y-4">
          {history.map((row) => (
            <li key={row.assentId} className="border-b border-border pb-4">
              <p className="font-medium">{row.title}</p>
              <p className="text-sm text-muted-foreground">
                {row.kind} · {row.versionLabel} · {row.assentedAt}
              </p>
              <p className="font-mono text-xs break-all">{row.contentHash}</p>
              <p className="text-sm">
                {row.isCurrentPublished
                  ? "Matches current published version"
                  : `Document state: ${row.documentState} (prior assent retained)`}
              </p>
            </li>
          ))}
        </ul>
      )}
      <p className="text-sm">
        Machine-readable download:{" "}
        <a className="underline" href="/api/assent/history">
          /api/assent/history
        </a>
      </p>
    </MainContainer>
  );
}
