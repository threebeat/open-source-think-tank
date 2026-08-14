import type { Metadata } from "next";

import { AgendaTopicList } from "@/components/agenda/AgendaTopicList";
import { HostedPolisUnavailable } from "@/components/agenda/HostedPolisUnavailable";
import { DisclosureNotice } from "@/components/DisclosureNotice";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { MainContainer } from "@/components/layout/MainContainer";
import { requireMemberSession } from "@/lib/auth/guard";
import { loadMemberCommonsContext } from "@/lib/commons/member-context";
import { listAgenda } from "@/lib/agenda/service";
import type { AgendaListDto } from "@/lib/agenda/types";

export const metadata: Metadata = {
  title: "Agenda",
  description:
    "Commonhall Public Agenda — qualified topics in consultation and residency.",
};

export const dynamic = "force-dynamic";

function emptyList(): AgendaListDto {
  return {
    topics: [],
    hostedPolisEnabled: false,
    syntheticCatalog: false,
  };
}

export default async function AgendaPage() {
  const session = await requireMemberSession();
  const { db, principal, organizationId } = await loadMemberCommonsContext(
    session.accountId,
  );
  const listed = organizationId
    ? await listAgenda(db, { principal, organizationId })
    : { ok: true as const, value: emptyList() };
  const agenda = listed.ok ? listed.value : emptyList();

  return (
    <MainContainer className="space-y-8">
      <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "Agenda" }]} />
      <PageHeader
        eyebrow="Member hall"
        title="Agenda"
        description="Qualified topics on the Public Agenda. Preference, evidence quality, Chamber verdicts, and Council recommendations remain separate."
      />
      <DisclosureNotice title="Fixture consultation" tone="caution">
        Hosted Pol.is is unavailable. Members may record in-house agree,
        disagree, or pass positions on labeled synthetic statements. Community
        membership does not grant Chamber or Council seats.
      </DisclosureNotice>
      <HostedPolisUnavailable />
      <AgendaTopicList topics={agenda.topics} />
    </MainContainer>
  );
}
