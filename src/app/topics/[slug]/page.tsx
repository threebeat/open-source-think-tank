import { permanentRedirect } from "next/navigation";

import { legacyProductRedirect } from "@/lib/legacy-product-redirects";

type Props = { params: Promise<{ slug: string }> };

/** Legacy topic detail → Public Agenda topic. */
export default async function LegacyTopicDetailRedirect({ params }: Props) {
  const { slug } = await params;
  permanentRedirect(
    legacyProductRedirect(`/topics/${slug}`) ?? "/agenda",
  );
}
