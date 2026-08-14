import { permanentRedirect } from "next/navigation";

import { legacyProductRedirect } from "@/lib/legacy-product-redirects";

type Props = { params: Promise<{ slug: string }> };

/** Legacy decision record → Council topic. */
export default async function DecisionRedirect({ params }: Props) {
  const { slug } = await params;
  permanentRedirect(
    legacyProductRedirect(`/decisions/${slug}`) ?? "/council",
  );
}
