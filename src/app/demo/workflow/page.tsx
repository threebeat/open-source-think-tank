import { permanentRedirect } from "next/navigation";

import { authenticatedLegacyRedirect } from "@/lib/auth/account-gate";

/** Legacy workflow practice → Commonhall process tour. */
export default function DemoWorkflowRedirect() {
  permanentRedirect(authenticatedLegacyRedirect("/demo/workflow") ?? "/demo");
}
