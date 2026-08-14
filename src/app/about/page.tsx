import { permanentRedirect } from "next/navigation";

import { legacyProductRedirect } from "@/lib/legacy-product-redirects";

/** Legacy about page → Commonhall landing. */
export default function AboutRedirect() {
  permanentRedirect(legacyProductRedirect("/about") ?? "/");
}
