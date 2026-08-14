import { permanentRedirect } from "next/navigation";

import { authenticatedLegacyRedirect } from "@/lib/auth/account-gate";

type Props = { params: Promise<{ slug: string }> };

/** Legacy decision record → Council topic. */
export default async function DecisionRedirect({ params }: Props) {
  const { slug } = await params;
  permanentRedirect(
    authenticatedLegacyRedirect(`/decisions/${slug}`) ?? "/council",
  );
}
