import { permanentRedirect } from "next/navigation";

import { legacyProductRedirect } from "@/lib/legacy-product-redirects";

type Props = { params: Promise<{ slug: string }> };

/** Legacy formal topic detail → Public Agenda topic. */
export default async function FormalTopicDetailRedirect({ params }: Props) {
  const { slug } = await params;
  permanentRedirect(
    legacyProductRedirect(`/formal-topics/${slug}`) ?? "/agenda",
  );
}
