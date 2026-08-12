import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";

import { DisclosureNotice } from "@/components/DisclosureNotice";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { MainContainer } from "@/components/layout/MainContainer";
import { WorkspaceSearchForm } from "@/components/workspace/WorkspaceSearchForm";
import { resolveAppMode } from "@/lib/env/app-mode";
import {
  workspaceSearchQuerySchema,
  type WorkspaceSearchQuery,
} from "@/lib/search/schemas";
import type { WorkspaceSearchPage as SearchPageDto } from "@/lib/search/workspace-search";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Workspace search",
  description: "Search topics, claims, and evidence you are authorized to open.",
};

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(
  value: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default async function WorkspaceSearchPage({ searchParams }: PageProps) {
  if (resolveAppMode() !== "gated") {
    notFound();
  }

  const { requireGatedSession } = await import("@/lib/auth/guard");
  const gated = await requireGatedSession();
  if (!gated.ok) {
    if (gated.status === 401) redirect("/auth/sign-in");
    notFound();
  }

  const params = await searchParams;
  const rawQ = firstParam(params.q)?.trim() ?? "";
  const rawEntities = firstParam(params.entities);
  const entityList = rawEntities
    ? rawEntities.split(",").map((part) => part.trim()).filter(Boolean)
    : undefined;

  let initialError: string | null = null;
  let initial: SearchPageDto | null = null;

  if (rawQ.length > 0) {
    const parsed = workspaceSearchQuerySchema.safeParse({
      q: rawQ,
      entities: entityList,
      page: firstParam(params.page),
      pageSize: firstParam(params.pageSize),
    });
    if (!parsed.success) {
      initialError =
        "Enter a valid search (2–100 characters) and entity filters.";
    } else {
      const { getGatedDb } = await import("@/lib/auth/runtime");
      const { searchWorkspace } = await import("@/lib/search/workspace-search");
      const query: WorkspaceSearchQuery = parsed.data;
      const result = await searchWorkspace(
        getGatedDb(),
        gated.session.accountId,
        query,
      );
      if (!result.ok) {
        if (result.code.startsWith("AUTHZ")) {
          redirect("/");
        }
        initialError =
          "Search is temporarily unavailable. No internal details are shown.";
      } else {
        initial = result.value;
      }
    }
  }

  return (
    <MainContainer className="space-y-8">
      <Breadcrumbs
        items={[{ href: "/", label: "Home" }, { label: "Workspace search" }]}
      />
      <PageHeader
        eyebrow="Gated workspace"
        title="Search"
        description="Find topics, claims, and evidence within your authorized audience. Results are metadata summaries with links only to routes you may open."
      />
      <DisclosureNotice title="No people search" tone="neutral">
        This surface does not search accounts, contact channels, private
        disclosure detail, private review notes, or privileged pseudonym maps.
        Auditor-only access does not grant content search.
      </DisclosureNotice>
      <p className="text-sm">
        <Link
          href="/workspace/submissions"
          className="text-primary underline underline-offset-2"
        >
          My submissions
        </Link>
        <span className="text-muted-foreground">
          {" "}
          ·{" "}
          <Link
            href="/workspace/review"
            className="text-primary underline underline-offset-2"
          >
            Review queues
          </Link>
        </span>
      </p>

      <Suspense
        fallback={
          <p className="text-sm text-muted-foreground">Loading search…</p>
        }
      >
        <WorkspaceSearchForm
          initial={initial}
          initialError={initialError}
          initialQuery={rawQ}
          initialEntities={entityList ?? ["topics", "claims", "evidence"]}
        />
      </Suspense>
    </MainContainer>
  );
}
