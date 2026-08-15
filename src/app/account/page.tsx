import Link from "next/link";

import { DisclosureNotice } from "@/components/DisclosureNotice";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { MainContainer } from "@/components/layout/MainContainer";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { getAccountProfile } from "@/lib/auth/account-profile";
import { PRE_ALPHA_ASSIGNMENT_EXPLANATION } from "@/lib/auth/community-standards";
import { requireMemberSession } from "@/lib/auth/guard";
import { COMMONS_CATEGORY_LABELS } from "@/lib/commons/categories";
import { listDiscussionsForAuthor } from "@/lib/commons/repository";
import { resolveAppMode } from "@/lib/env/app-mode";
import { formatPublicDateTime } from "@/lib/format/public-datetime";
import { PRE_ALPHA_ORG_NAME } from "@/lib/pre-alpha/member-views";
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
  const session = await requireMemberSession();

  let identifier = "Signed in";
  let displayTitle = "Your account";
  let organizationName = PRE_ALPHA_ORG_NAME;
  let organizationSlug = "ostt-synth-alpha";
  let membershipStatus = "active · primary";
  let rank = "Community member";
  let posts: Array<{
    publicId: string;
    title: string;
    categoryLabel: string;
    createdAtLabel: string;
  }> = [];
  let history: Array<{ id: string; eventKind: string; atLabel: string; reason?: string | null }> =
    [];

  if (resolveAppMode() === "gated") {
    const { getGatedDb } = await import("@/lib/auth/runtime");
    const db = getGatedDb();
    const profile = await getAccountProfile(db, session.accountId);
    identifier = profile?.identifier ?? identifier;
    displayTitle = profile?.displayName?.trim() || displayTitle;
    const memberships = await listMembershipsForAccount(db, session.accountId);
    const primary = memberships.find((row) => row.isPrimary) ?? memberships[0];
    const organization = primary
      ? await getOrganization(db, primary.organizationId)
      : null;
    organizationName = organization?.displayName ?? "Not assigned";
    organizationSlug = organization?.slug ?? "";
    membershipStatus = primary
      ? `${primary.status}${primary.isPrimary ? " · primary" : ""}`
      : "none";
    const appointments = await listActiveAppointmentsForAccount(
      db,
      session.accountId,
    );
    rank =
      appointments.length > 0
        ? appointments.map((row) => RANK_LABELS[row.appointmentKind]).join(" · ")
        : "Community member";
    const events = await listMembershipEventsForAccount(db, session.accountId);
    history = [...events]
      .sort((a, b) => b.at.getTime() - a.at.getTime())
      .map((event) => ({
        id: event.id,
        eventKind: event.eventKind,
        atLabel: event.at.toLocaleString(undefined, { timeZoneName: "short" }),
        reason: event.reason,
      }));
    const authored = primary
      ? await listDiscussionsForAuthor(db, primary.organizationId, session.accountId)
      : [];
    posts = authored.map((post) => ({
      publicId: post.publicId,
      title: post.title,
      categoryLabel: COMMONS_CATEGORY_LABELS[post.category],
      createdAtLabel: formatPublicDateTime(post.createdAt.toISOString()),
    }));
  } else {
    const { findLocalAccount, readLocalAccounts, readPreAlphaSessionFromStore } =
      await import("@/lib/auth/pre-alpha-local");
    const { cookies } = await import("next/headers");
    const local = await readPreAlphaSessionFromStore();
    identifier = local?.identifier ?? identifier;
    displayTitle = identifier.split("@")[0] || displayTitle;
    const jar = await cookies();
    const account = findLocalAccount(
      readLocalAccounts(jar.get("ch_prealpha_accounts")?.value),
      identifier,
    );
    posts =
      account?.posts.map((post) => ({
        publicId: post.publicId,
        title: post.title,
        categoryLabel: COMMONS_CATEGORY_LABELS[post.category],
        createdAtLabel: formatPublicDateTime(post.createdAt),
      })) ?? [];
    history = [
      {
        id: "local-enrolled",
        eventKind: "enrolled",
        atLabel: account
          ? formatPublicDateTime(account.createdAt)
          : "Just now",
        reason: "Created a pre-alpha community account.",
      },
    ];
  }

  return (
    <MainContainer className="space-y-10">
      <Breadcrumbs
        items={[{ href: "/", label: "Home" }, { label: "Account" }]}
      />
      <PageHeader
        eyebrow="Signed in"
        title={displayTitle}
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
          <p className="font-medium break-all">{identifier}</p>
        </div>
        <div className="rounded-md border border-border p-4">
          <p className="text-sm text-muted-foreground">Account lifecycle</p>
          <p className="font-medium">{session.lifecycleState}</p>
          {session.synthetic ? (
            <p className="text-sm text-muted-foreground">Synthetic pre-alpha row</p>
          ) : null}
        </div>
        <div className="rounded-md border border-border p-4">
          <p className="text-sm text-muted-foreground">Local organization</p>
          <p className="font-medium">{organizationName}</p>
          {organizationSlug ? (
            <p className="text-sm text-muted-foreground">{organizationSlug}</p>
          ) : null}
        </div>
        <div className="rounded-md border border-border p-4">
          <p className="text-sm text-muted-foreground">Membership status</p>
          <p className="font-medium">{membershipStatus}</p>
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
                  {post.categoryLabel}
                  {" · "}
                  {post.createdAtLabel}
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
                <p className="text-muted-foreground">{event.atLabel}</p>
                {event.reason ? <p className="mt-2">{event.reason}</p> : null}
              </li>
            ))}
          </ol>
        )}
      </section>

      <SignOutButton />

      {resolveAppMode() === "gated" ? (
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
      ) : null}
    </MainContainer>
  );
}
