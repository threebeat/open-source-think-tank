import { redirect } from "next/navigation";
import Link from "next/link";

import { DisclosureNotice } from "@/components/DisclosureNotice";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { MainContainer } from "@/components/layout/MainContainer";
import { getAccountProfile } from "@/lib/auth/account-profile";
import { PRE_ALPHA_ASSIGNMENT_EXPLANATION } from "@/lib/auth/community-standards";
import { requireMemberSession } from "@/lib/auth/guard";
import { COMMONS_CATEGORY_LABELS } from "@/lib/commons/categories";
import { listDiscussionsForAuthor } from "@/lib/commons/repository";
import { resolveAppMode } from "@/lib/env/app-mode";
import { formatPublicDateTime } from "@/lib/format/public-datetime";
import { listActiveAppointmentsForAccount } from "@/lib/organizations/appointment-repository";
import {
  listMembershipEventsForAccount,
  listMembershipsForAccount,
} from "@/lib/organizations/membership-repository";
import { getOrganization } from "@/lib/organizations/repository";
import type { OrganizationAppointmentKind } from "@/lib/organizations/types";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Account",
  description:
    "Commonhall account home — membership, rank, posts, and assignment history.",
};

const RANK_LABELS: Record<OrganizationAppointmentKind, string> = {
  chamber_member: "Chamber member",
  chamber_clerk: "Chamber clerk",
  council_member: "Council member",
  council_clerk: "Council clerk",
  moderator: "Moderator",
  organization_admin: "Organization admin",
};

export default async function AccountPage() {
  if (resolveAppMode() !== "gated") {
    redirect("/");
  }

  const session = await requireMemberSession();
  const { getGatedDb } = await import("@/lib/auth/runtime");
  const db = getGatedDb();
  const profile = await getAccountProfile(db, session.accountId);

  const memberships = await listMembershipsForAccount(db, session.accountId);
  const primary = memberships.find((row) => row.isPrimary) ?? memberships[0];
  const organization = primary
    ? await getOrganization(db, primary.organizationId)
    : null;
  const appointments = await listActiveAppointmentsForAccount(
    db,
    session.accountId,
  );
  const events = await listMembershipEventsForAccount(db, session.accountId);
  const history = [...events].sort((a, b) => b.at.getTime() - a.at.getTime());
  const posts = primary
    ? await listDiscussionsForAuthor(db, primary.organizationId, session.accountId)
    : [];

  const rank =
    appointments.length > 0
      ? appointments.map((row) => RANK_LABELS[row.appointmentKind]).join(" · ")
      : "Community member";

  return (
    <MainContainer className="space-y-10">
      <Breadcrumbs
        items={[{ href: "/", label: "Home" }, { label: "Account" }]}
      />
      <PageHeader
        eyebrow="Signed in"
        title={profile?.displayName?.trim() || "Your account"}
        description="Community membership is organization service membership in this pre-alpha synthetic hall. It is not nonprofit or statutory membership."
      />
      <DisclosureNotice title="Assignment explanation" tone="neutral">
        {PRE_ALPHA_ASSIGNMENT_EXPLANATION}
      </DisclosureNotice>

      <section className="grid gap-4 sm:grid-cols-2" aria-labelledby="account-status">
        <h2 id="account-status" className="sr-only">
          Membership status
        </h2>
        <div className="rounded-md border border-border p-4">
          <p className="text-sm text-muted-foreground">Identifier</p>
          <p className="font-medium break-all">
            {profile?.identifier ?? "Signed in"}
          </p>
        </div>
        <div className="rounded-md border border-border p-4">
          <p className="text-sm text-muted-foreground">Local organization</p>
          <p className="font-medium">
            {organization?.displayName ?? "Not assigned"}
          </p>
          {organization?.slug ? (
            <p className="text-sm text-muted-foreground">{organization.slug}</p>
          ) : null}
        </div>
        <div className="rounded-md border border-border p-4">
          <p className="text-sm text-muted-foreground">Membership status</p>
          <p className="font-medium">
            {primary?.status ?? "none"}
            {primary?.isPrimary ? " · primary" : ""}
          </p>
        </div>
        <div className="rounded-md border border-border p-4">
          <p className="text-sm text-muted-foreground">Rank</p>
          <p className="font-medium">{rank}</p>
          <p className="text-sm text-muted-foreground">
            Enrollment never grants Chamber, Council, moderator, or
            organization-admin authority.
          </p>
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="account-posts">
        <h2 id="account-posts" className="font-heading text-2xl">
          Your posts and discussions
        </h2>
        {posts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            You have not posted yet. Open Commons to start a discussion.
          </p>
        ) : (
          <ul className="space-y-3">
            {posts.map((post) => (
              <li key={post.publicId} className="rounded-md border border-border p-4">
                <Link
                  className="font-medium underline underline-offset-2"
                  href={`/commons/discussions/${post.publicId}`}
                >
                  {post.title}
                </Link>
                <p className="mt-1 text-sm text-muted-foreground">
                  {COMMONS_CATEGORY_LABELS[post.category]}
                  {" · "}
                  {formatPublicDateTime(post.createdAt.toISOString())}
                </p>
              </li>
            ))}
          </ul>
        )}
        <p>
          <Link className="text-sm underline" href="/commons">
            Go to Commons
          </Link>
        </p>
      </section>

      <section className="space-y-3" aria-labelledby="account-history">
        <h2 id="account-history" className="font-heading text-2xl">
          Account history
        </h2>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">No membership events yet.</p>
        ) : (
          <ol className="space-y-3">
            {history.map((event) => (
              <li
                key={event.id}
                className="rounded-md border border-border p-4 text-sm"
              >
                <p className="font-medium">{event.eventKind}</p>
                <p className="text-muted-foreground">
                  {event.at.toLocaleString(undefined, { timeZoneName: "short" })}
                </p>
                {event.reason ? <p className="mt-2">{event.reason}</p> : null}
              </li>
            ))}
          </ol>
        )}
      </section>

      <nav aria-label="Account sections" className="flex flex-wrap gap-4 text-sm">
        <Link className="underline" href="/account/profile">
          Profile
        </Link>
        <Link className="underline" href="/account/membership">
          Membership
        </Link>
        <Link className="underline" href="/account/history">
          Full history
        </Link>
        <Link className="underline" href="/account/privacy">
          Privacy
        </Link>
      </nav>
    </MainContainer>
  );
}
