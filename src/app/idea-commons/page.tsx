import { permanentRedirect } from "next/navigation";

import { legacyProductRedirect } from "@/lib/legacy-product-redirects";

/** Legacy Idea Commons list → Commons. */
export default function IdeaCommonsRedirect() {
  permanentRedirect(legacyProductRedirect("/idea-commons") ?? "/commons");
}
