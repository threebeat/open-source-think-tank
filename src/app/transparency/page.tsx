import { permanentRedirect } from "next/navigation";

import { legacyProductRedirect } from "@/lib/legacy-product-redirects";

/** Legacy Public Record / transparency → Records. */
export default function TransparencyRedirect() {
  permanentRedirect(legacyProductRedirect("/transparency") ?? "/records");
}
