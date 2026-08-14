import { permanentRedirect } from "next/navigation";

import { legacyProductRedirect } from "@/lib/legacy-product-redirects";

type Props = { params: Promise<{ slug: string }> };

/** Legacy member-actions page → Records topic. */
export default async function MemberActionsRedirect({ params }: Props) {
  const { slug } = await params;
  permanentRedirect(
    legacyProductRedirect(`/actions/${slug}`) ?? "/records",
  );
}
