import { permanentRedirect } from "next/navigation";

import { legacyProductRedirect } from "@/lib/legacy-product-redirects";

type Props = { params: Promise<{ slug: string }> };

/** Legacy deliberation observer → Chamber topic. */
export default async function DeliberationRedirect({ params }: Props) {
  const { slug } = await params;
  permanentRedirect(
    legacyProductRedirect(`/deliberation/${slug}`) ?? "/chamber",
  );
}
