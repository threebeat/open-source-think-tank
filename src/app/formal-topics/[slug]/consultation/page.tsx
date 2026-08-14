import { permanentRedirect } from "next/navigation";

import { authenticatedLegacyRedirect } from "@/lib/auth/account-gate";

type Props = { params: Promise<{ slug: string }> };

/** Legacy consultation surface → Public Agenda topic. */
export default async function FormalTopicConsultationRedirect({
  params,
}: Props) {
  const { slug } = await params;
  permanentRedirect(
    authenticatedLegacyRedirect(`/formal-topics/${slug}/consultation`) ??
      "/agenda",
  );
}
