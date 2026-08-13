import { redirect } from "next/navigation";

import {
  parseTopicSection,
  topicSectionHref,
} from "@/features/formal-topics/topic-section";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ section?: string | string[] }>;
};

/**
 * Legacy topic detail → canonical Formal Topic Pipeline page.
 * Preserves allowlisted section query; drops other params.
 */
export default async function LegacyTopicDetailRedirect({
  params,
  searchParams,
}: Props) {
  const { slug } = await params;
  const query = await searchParams;
  const section = parseTopicSection(query.section);
  redirect(topicSectionHref(slug, section));
}
