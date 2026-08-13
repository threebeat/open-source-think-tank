import { DisclosureNotice } from "@/components/DisclosureNotice";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { MainContainer } from "@/components/layout/MainContainer";
import type { CanonicalTopicViewModel } from "@/features/formal-topics/canonical-topic-model";
import { TopicDiscussionsSection } from "@/features/formal-topics/TopicDiscussionsSection";
import { TopicEvidenceSection } from "@/features/formal-topics/TopicEvidenceSection";
import { TopicOverviewSection } from "@/features/formal-topics/TopicOverviewSection";
import { TopicSectionNav } from "@/features/formal-topics/TopicSectionNav";
import type { TopicSection } from "@/features/formal-topics/topic-section";

type Props = {
  model: CanonicalTopicViewModel;
  section: TopicSection;
};

export function CanonicalTopicPage({ model, section }: Props) {
  return (
    <MainContainer className="space-y-8">
      <Breadcrumbs
        items={[
          { href: "/", label: "Home" },
          { href: "/formal-topics", label: "Formal Topics" },
          { label: model.title },
        ]}
      />
      <PageHeader
        eyebrow="Formal Topic Pipeline"
        title={model.title}
        description={model.question}
      />

      <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="font-medium text-foreground">Current stage</dt>
          <dd className="mt-1 text-muted-foreground">{model.stageLabel}</dd>
        </div>
        <div>
          <dt className="font-medium text-foreground">Jurisdiction / scope</dt>
          <dd className="mt-1 text-muted-foreground">{model.jurisdictionLabel}</dd>
        </div>
        <div>
          <dt className="font-medium text-foreground">Last public update</dt>
          <dd className="mt-1 text-muted-foreground">
            {model.lastPublicUpdate ?? "Not recorded"}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-foreground">Lane</dt>
          <dd className="mt-1 text-muted-foreground">{model.lane}</dd>
        </div>
      </dl>

      <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
        {model.introduction}
      </p>

      <DisclosureNotice title="Topic disclosure" tone="caution">
        {model.disclosure}
      </DisclosureNotice>

      <TopicSectionNav slug={model.slug} active={section} />

      {section === "overview" ? <TopicOverviewSection model={model} /> : null}
      {section === "evidence" ? <TopicEvidenceSection model={model} /> : null}
      {section === "discussions" ? (
        <TopicDiscussionsSection model={model} />
      ) : null}
    </MainContainer>
  );
}
