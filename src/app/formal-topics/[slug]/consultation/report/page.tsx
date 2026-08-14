import { permanentRedirect } from "next/navigation";

import { authenticatedLegacyRedirect } from "@/lib/auth/account-gate";

type Props = { params: Promise<{ slug: string }> };

/** Legacy Public Input report page → Public Agenda topic. */
export default async function FormalTopicConsultationReportRedirect({
  params,
}: Props) {
  const { slug } = await params;
  permanentRedirect(
    authenticatedLegacyRedirect(
      `/formal-topics/${slug}/consultation/report`,
    ) ?? "/agenda",
  );
}
