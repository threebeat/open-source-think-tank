import { permanentRedirect } from "next/navigation";

import { authenticatedLegacyRedirect } from "@/lib/auth/account-gate";

/** Legacy think-tank process page → Commonhall demo. */
export default function ProcessRedirect() {
  permanentRedirect(authenticatedLegacyRedirect("/process") ?? "/demo");
}
