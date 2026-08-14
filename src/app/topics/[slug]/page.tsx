import { permanentRedirect } from "next/navigation";

import { authenticatedLegacyRedirect } from "@/lib/auth/account-gate";

type Props = { params: Promise<{ slug: string }> };

/** Legacy topic detail → Public Agenda topic. */
export default async function LegacyTopicDetailRedirect({ params }: Props) {
  const { slug } = await params;
  permanentRedirect(
    authenticatedLegacyRedirect(`/topics/${slug}`) ?? "/agenda",
  );
}
