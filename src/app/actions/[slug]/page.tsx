import { permanentRedirect } from "next/navigation";

import { authenticatedLegacyRedirect } from "@/lib/auth/account-gate";

type Props = { params: Promise<{ slug: string }> };

/** Legacy member-actions page → Records topic. */
export default async function MemberActionsRedirect({ params }: Props) {
  const { slug } = await params;
  permanentRedirect(
    authenticatedLegacyRedirect(`/actions/${slug}`) ?? "/records",
  );
}
