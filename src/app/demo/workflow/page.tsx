import { permanentRedirect } from "next/navigation";

import { legacyProductRedirect } from "@/lib/legacy-product-redirects";

/** Legacy workflow practice → Commonhall process tour. */
export default function DemoWorkflowRedirect() {
  permanentRedirect(legacyProductRedirect("/demo/workflow") ?? "/demo");
}
