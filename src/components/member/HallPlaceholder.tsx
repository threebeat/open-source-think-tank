import { DisclosureNotice } from "@/components/DisclosureNotice";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { MainContainer } from "@/components/layout/MainContainer";

type HallPlaceholderProps = {
  title: string;
  description: string;
};

export function HallPlaceholder({ title, description }: HallPlaceholderProps) {
  return (
    <MainContainer className="space-y-8">
      <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: title }]} />
      <PageHeader
        eyebrow="Authenticated hall"
        title={title}
        description={description}
      />
      <DisclosureNotice title="Opens in a later Commonhall phase" tone="neutral">
        This hall is seeded in later phases. Your account is ready. Community
        membership does not grant Chamber, Council, moderator, or
        organization-admin authority.
      </DisclosureNotice>
    </MainContainer>
  );
}
