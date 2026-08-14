import { permanentRedirect } from "next/navigation";

import { legacyProductRedirect } from "@/lib/legacy-product-redirects";

type Props = { params: Promise<{ id: string }> };

/** Legacy Idea Commons thread → Commons. */
export default async function IdeaCommonsThreadRedirect({ params }: Props) {
  const { id } = await params;
  permanentRedirect(
    legacyProductRedirect(`/idea-commons/${id}`) ?? "/commons",
  );
}
