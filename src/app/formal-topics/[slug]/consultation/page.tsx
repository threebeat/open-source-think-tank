import { permanentRedirect } from "next/navigation";

import { legacyProductRedirect } from "@/lib/legacy-product-redirects";

type Props = { params: Promise<{ slug: string }> };

/** Legacy consultation surface → Public Agenda topic. */
export default async function FormalTopicConsultationRedirect({
  params,
}: Props) {
  const { slug } = await params;
  permanentRedirect(
    legacyProductRedirect(`/formal-topics/${slug}/consultation`) ??
      "/agenda",
  );
}
