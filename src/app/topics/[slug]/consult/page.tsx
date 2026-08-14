import { permanentRedirect } from "next/navigation";

import { authenticatedLegacyRedirect } from "@/lib/auth/account-gate";

type Props = { params: Promise<{ slug: string }> };

/** Legacy simulated consultation → Public Agenda topic. */
export default async function LegacyConsultRedirect({ params }: Props) {
  const { slug } = await params;
  permanentRedirect(
    authenticatedLegacyRedirect(`/topics/${slug}/consult`) ?? "/agenda",
  );
}
