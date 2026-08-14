import { redirect } from "next/navigation";

import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { MainContainer } from "@/components/layout/MainContainer";
import { requireMemberSession } from "@/lib/auth/guard";
import { resolveAppMode } from "@/lib/env/app-mode";
import { listMembershipEventsForAccount } from "@/lib/organizations/membership-repository";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Membership history",
  description: "Append-only organization assignment history.",
};

export default async function AccountHistoryPage() {
  if (resolveAppMode() !== "gated") {
    redirect("/");
  }
  const session = await requireMemberSession();
  const { getGatedDb } = await import("@/lib/auth/runtime");
  const events = await listMembershipEventsForAccount(
    getGatedDb(),
    session.accountId,
  );
  const sorted = [...events].sort((a, b) => a.at.getTime() - b.at.getTime());

  return (
    <MainContainer className="space-y-8">
      <Breadcrumbs
        items={[
          { href: "/", label: "Home" },
          { href: "/account", label: "Account" },
          { label: "History" },
        ]}
      />
      <PageHeader
        eyebrow="Append-only"
        title="Membership history"
        description="Assignment and correction events cannot be edited in place. Times are shown in your local timezone."
      />
      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">No membership events yet.</p>
      ) : (
        <ol className="space-y-3">
          {sorted.map((event) => (
            <li
              key={event.id}
              className="rounded-md border border-border p-4 text-sm"
            >
              <p className="font-medium">{event.eventKind}</p>
              <p className="text-muted-foreground">
                {event.at.toLocaleString(undefined, { timeZoneName: "short" })}
              </p>
              {event.reason ? <p className="mt-2">{event.reason}</p> : null}
              <p className="mt-1 text-xs text-muted-foreground">
                Rule {event.ruleVersion}
              </p>
            </li>
          ))}
        </ol>
      )}
    </MainContainer>
  );
}
