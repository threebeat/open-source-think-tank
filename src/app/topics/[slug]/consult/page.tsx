import { permanentRedirect } from "next/navigation";

import { legacyProductRedirect } from "@/lib/legacy-product-redirects";

type Props = { params: Promise<{ slug: string }> };

/** Legacy simulated consultation → Public Agenda topic. */
export default async function LegacyConsultRedirect({ params }: Props) {
  const { slug } = await params;
  permanentRedirect(
    legacyProductRedirect(`/topics/${slug}/consult`) ?? "/agenda",
  );
}
