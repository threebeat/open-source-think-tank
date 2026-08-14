import { permanentRedirect } from "next/navigation";

import { legacyProductRedirect } from "@/lib/legacy-product-redirects";

/** Legacy think-tank process page → Commonhall demo. */
export default function ProcessRedirect() {
  permanentRedirect(legacyProductRedirect("/process") ?? "/demo");
}
