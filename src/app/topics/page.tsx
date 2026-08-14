import { permanentRedirect } from "next/navigation";

import { legacyProductRedirect } from "@/lib/legacy-product-redirects";

/** Legacy Topics list → Public Agenda. Workspace authoring stays under /workspace/topics. */
export default function TopicsRedirect() {
  permanentRedirect(legacyProductRedirect("/topics") ?? "/agenda");
}
