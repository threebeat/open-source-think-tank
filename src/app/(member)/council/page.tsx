import type { Metadata } from "next";

import { BodyTopicList } from "@/components/bodies/BodyTopicList";
import { RosterTable } from "@/components/bodies/RosterTable";
import { DisclosureNotice } from "@/components/DisclosureNotice";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { MainContainer } from "@/components/layout/MainContainer";
import { requireMemberSession } from "@/lib/auth/guard";
import { listCouncil } from "@/lib/bodies/service";
import type { BodyListDto } from "@/lib/bodies/types";
import { loadMemberCommonsContext } from "@/lib/commons/member-context";
import { resolveAppMode } from "@/lib/env/app-mode";
import { localCouncilList } from "@/lib/pre-alpha/member-views";

export const metadata: Metadata = {
  title: "Council",
  description:
    "Commonhall Council — intake, recommendations, and public roll calls.",
};

export const dynamic = "force-dynamic";

function emptyList(): BodyListDto {
  return {
    topics: [],
    roster: [],
    syntheticCatalog: false,
    hostedPolisEnabled: false,
  };
}

export default async function CouncilPage() {
  const session = await requireMemberSession();
  let council = emptyList();
  if (resolveAppMode() !== "gated") {
    council = localCouncilList();
  } else {
    const { db, principal, organizationId } = await loadMemberCommonsContext(
      session.accountId,
    );
    const listed =
      organizationId && db
        ? await listCouncil(db, { principal, organizationId })
        : { ok: true as const, value: emptyList() };
    council = listed.ok ? listed.value : emptyList();
  }

  return (
    <MainContainer className="space-y-8">
      <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "Council" }]} />
      <PageHeader
        eyebrow="Member hall"
        title="Council"
        description="The organization Council accepts or declines Chamber topics. Community membership does not grant a Council seat. Council acceptance removes a topic from the Public Agenda."
      />
      <DisclosureNotice title="Synthetic fixture" tone="caution">
        This roster is labeled synthetic. It is not a production Council
        cadence or quorum (V2-10). Hosted Pol.is remains unavailable.
      </DisclosureNotice>
      <section className="space-y-4" aria-labelledby="council-roster-heading">
        <h2 id="council-roster-heading" className="font-heading text-xl tracking-tight">
          Roster
        </h2>
        <RosterTable
          caption="Synthetic Council roster. Seats are organization-issued and time-bounded."
          seats={council.roster}
        />
      </section>
      <section className="space-y-4" aria-labelledby="council-topics-heading">
        <h2 id="council-topics-heading" className="font-heading text-xl tracking-tight">
          Topics
        </h2>
        <BodyTopicList
          topics={council.topics}
          hrefBase="/council"
          empty="No Council topics are listed for this organization."
        />
      </section>
    </MainContainer>
  );
}
