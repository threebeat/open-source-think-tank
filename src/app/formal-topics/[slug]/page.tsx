import { permanentRedirect } from "next/navigation";

import { authenticatedLegacyRedirect } from "@/lib/auth/account-gate";

type Props = { params: Promise<{ slug: string }> };

/** Legacy formal topic detail → Public Agenda topic. */
export default async function FormalTopicDetailRedirect({ params }: Props) {
  const { slug } = await params;
  permanentRedirect(
    authenticatedLegacyRedirect(`/formal-topics/${slug}`) ?? "/agenda",
  );
}
