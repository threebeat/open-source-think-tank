import type { Metadata } from "next";

import { JoinWalkthrough } from "@/components/join/JoinWalkthrough";
import { DisclosureNotice } from "@/components/DisclosureNotice";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { MainContainer } from "@/components/layout/MainContainer";

export const metadata: Metadata = {
  title: "Join preview",
  description:
    "Nonfunctional preview of eligibility, verification concepts, conduct, and privacy steps. Synthetic demonstration only; no information is collected.",
};

export default function JoinPage() {
  return (
    <MainContainer className="space-y-8">
      <Breadcrumbs
        items={[{ href: "/", label: "Home" }, { label: "Join preview" }]}
      />
      <PageHeader
        eyebrow="Nonfunctional preview"
        title="Join preview"
        description="A walkthrough of the intended eligibility, assurance, conduct, and privacy steps. Community participant status is not a settled legal membership category. Identification documents are not assumed to be required for every role."
      />
      <DisclosureNotice title="Not accepting members" tone="caution">
        This demonstration does not enroll anyone, collect personal information, or
        record legally binding assent. Placeholder conduct and privacy text is not
        legally reviewed.
      </DisclosureNotice>
      <JoinWalkthrough />
    </MainContainer>
  );
}
