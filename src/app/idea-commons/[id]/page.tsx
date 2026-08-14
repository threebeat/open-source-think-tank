import { permanentRedirect } from "next/navigation";

import { authenticatedLegacyRedirect } from "@/lib/auth/account-gate";

type Props = { params: Promise<{ id: string }> };

/** Legacy Idea Commons thread → Commons. */
export default async function IdeaCommonsThreadRedirect({ params }: Props) {
  const { id } = await params;
  permanentRedirect(
    authenticatedLegacyRedirect(`/idea-commons/${id}`) ?? "/commons",
  );
}
