import { permanentRedirect } from "next/navigation";

import { legacyProductRedirect } from "@/lib/legacy-product-redirects";

/** Legacy Formal Topics list → Public Agenda. */
export default function FormalTopicsRedirect() {
  permanentRedirect(legacyProductRedirect("/formal-topics") ?? "/agenda");
}
