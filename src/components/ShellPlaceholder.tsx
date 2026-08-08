import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { MainContainer } from "@/components/layout/MainContainer";
import { DisclosureNotice } from "@/components/DisclosureNotice";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";

type ShellPlaceholderProps = {
  title: string;
  description: string;
  breadcrumbLabel: string;
};

export function ShellPlaceholder({
  title,
  description,
  breadcrumbLabel,
}: ShellPlaceholderProps) {
  return (
    <MainContainer className="space-y-8">
      <Breadcrumbs
        items={[{ href: "/", label: "Home" }, { label: breadcrumbLabel }]}
      />
      <PageHeader title={title} description={description} />
      <DisclosureNotice title="Placeholder route">
        This screen is a shell placeholder so navigation and layout can be
        reviewed before the dedicated work package fills in the content.
      </DisclosureNotice>
      <EmptyState
        title="Content arrives in a later work package"
        description="The application shell, navigation, and reusable components are in place. Route-specific synthetic content will land when that package is approved."
      />
    </MainContainer>
  );
}
