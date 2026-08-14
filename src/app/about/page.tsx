import type { Metadata } from "next";

import { DisclosureNotice } from "@/components/DisclosureNotice";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { MainContainer } from "@/components/layout/MainContainer";
import { DEMO_NONPROFIT_CONTACT } from "@/lib/demo/pre-alpha-fixtures";

export const metadata: Metadata = {
  title: "About",
  description:
    "Mission of Commonhall and synthetic contact details for the nonprofit workshop.",
};

export default function AboutPage() {
  const contact = DEMO_NONPROFIT_CONTACT;
  return (
    <MainContainer className="space-y-10">
      <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "About" }]} />
      <PageHeader
        eyebrow="About the service"
        title="About Commonhall"
        description="A proposed public, nonpartisan digital town hall. Community membership here is organization service membership in a pre-alpha synthetic hall."
      />
      <DisclosureNotice title="Synthetic nonprofit contact" tone="neutral">
        The address, phone, and email below are placeholders for the nonprofit
        workshop. They are not a live inbox and do not prove incorporation or
        tax status.
      </DisclosureNotice>
      <section className="space-y-3" aria-labelledby="about-mission">
        <h2 id="about-mission" className="font-heading text-2xl">
          Mission
        </h2>
        <p className="max-w-3xl text-base leading-7 text-muted-foreground">
          Commonhall gives a town a public place to raise questions, check
          evidence, consult neighbors, and watch appointed bodies record
          explicit decisions. Preference, evidence quality, Chamber verdicts,
          and Council recommendations stay on separate axes. Algorithms
          organize; named people decide.
        </p>
      </section>
      <section className="space-y-3" aria-labelledby="about-contact">
        <h2 id="about-contact" className="font-heading text-2xl">
          Nonprofit workshop contact
        </h2>
        <dl className="grid max-w-xl gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Organization</dt>
            <dd className="font-medium">{contact.organizationName}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Email</dt>
            <dd className="font-medium break-all">{contact.email}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Phone</dt>
            <dd className="font-medium">{contact.phone}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Hours</dt>
            <dd className="font-medium">{contact.hours}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-muted-foreground">Mail</dt>
            <dd className="font-medium">{contact.mail}</dd>
          </div>
        </dl>
      </section>
    </MainContainer>
  );
}
