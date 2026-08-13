import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { MainContainer } from "@/components/layout/MainContainer";
import { ConsultationSurface } from "@/features/public-input/ConsultationSurface";
import { loadPublicDemoCanonicalTopic } from "@/features/formal-topics/load-public-demo-topic";
import { resolveAppMode } from "@/lib/env/app-mode";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ fixtureState?: string | string[] }>;
};

export const dynamic = "force-dynamic";

const FIXTURE_STATES = [
  "ready",
  "open",
  "commenting_closed",
  "voting_closed",
  "closed",
  "archived",
] as const;

type FixtureWorkflowState = (typeof FIXTURE_STATES)[number];

function parseFixtureState(
  value: string | string[] | undefined,
): FixtureWorkflowState | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return null;
  return (FIXTURE_STATES as readonly string[]).includes(raw)
    ? (raw as FixtureWorkflowState)
    : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `Consultation · ${slug}`,
    description:
      "Institutional Public Input consultation surface. Live provider embed remains fail-closed.",
  };
}

export default async function FormalTopicConsultationPage({
  params,
  searchParams,
}: Props) {
  const { slug } = await params;
  const query = await searchParams;
  const mode = resolveAppMode();

  if (mode === "public-demo") {
    const model = loadPublicDemoCanonicalTopic(slug);
    if (!model) {
      notFound();
    }
    const fixtureState = parseFixtureState(query.fixtureState);
    const consultation = fixtureState
      ? {
          topicId: "fixture-topic",
          workflowState: fixtureState,
          providerAvailability:
            fixtureState === "open" && query.fixtureState === "open-degraded"
              ? ("degraded" as const)
              : ("not_configured" as const),
          publicTitle: `Fixture consultation · ${model.title}`,
          publicPrompt:
            "Synthetic prompt for progressive disclosure and lifecycle documentation. Not a live provider conversation.",
          opensAt: "2026-08-01T12:00:00.000Z",
          closesAt: null,
          configurationVersion: 1,
        }
      : null;

    // Allow explicit degraded/unavailable fixture demos via dedicated tokens.
    const availabilityOverride =
      query.fixtureState === "degraded"
        ? ("degraded" as const)
        : query.fixtureState === "unavailable"
          ? ("unavailable" as const)
          : null;
    const consultationWithAvailability =
      availabilityOverride && consultation
        ? {
            ...consultation,
            workflowState: "open" as const,
            providerAvailability: availabilityOverride,
          }
        : query.fixtureState === "degraded" ||
            query.fixtureState === "unavailable"
          ? {
              topicId: "fixture-topic",
              workflowState: "open" as const,
              providerAvailability: availabilityOverride!,
              publicTitle: `Fixture consultation · ${model.title}`,
              publicPrompt:
                "Synthetic prompt for outage documentation. Provider availability is independent of institutional workflow.",
              opensAt: "2026-08-01T12:00:00.000Z",
              closesAt: null,
              configurationVersion: 1,
            }
          : consultation;

    return (
      <MainContainer className="space-y-8">
        <Breadcrumbs
          items={[
            { href: "/", label: "Home" },
            { href: "/formal-topics", label: "Formal Topics" },
            { href: `/formal-topics/${slug}`, label: model.title },
            { label: "Consultation" },
          ]}
        />
        <ConsultationSurface
          topicSlug={slug}
          topicTitle={model.title}
          consultation={consultationWithAvailability}
          lane="public-demo"
        />
      </MainContainer>
    );
  }

  await connection();
  const { loadGatedCanonicalTopic } = await import(
    "@/features/formal-topics/load-gated-canonical-topic"
  );
  const loaded = await loadGatedCanonicalTopic(slug);
  if (loaded.status === "not_found") {
    notFound();
  }
  if (loaded.status === "unavailable") {
    notFound();
  }

  const { getGatedDb } = await import("@/lib/auth/runtime");
  const { getTopicBySlug } = await import("@/lib/topics/repository");
  const { getPublicConsultationView } = await import(
    "@/lib/public-input/lifecycle/service"
  );

  const db = getGatedDb();
  const topicResult = await getTopicBySlug(db, slug);
  let consultation = null;
  let operationalNote: string | null = null;

  if (topicResult.ok && topicResult.value) {
    const view = await getPublicConsultationView(db, topicResult.value.id);
    if (view.ok) {
      consultation = view.value;
    } else {
      operationalNote =
        "Consultation projection temporarily unavailable. Topic overview and evidence remain available.";
    }
  }

  return (
    <MainContainer className="space-y-8">
      <Breadcrumbs
        items={[
          { href: "/", label: "Home" },
          { href: "/formal-topics", label: "Formal Topics" },
          { href: `/formal-topics/${slug}`, label: loaded.model.title },
          { label: "Consultation" },
        ]}
      />
      <ConsultationSurface
        topicSlug={slug}
        topicTitle={loaded.model.title}
        consultation={consultation}
        lane="gated"
        operationalNote={operationalNote}
      />
    </MainContainer>
  );
}
