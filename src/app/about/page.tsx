import { permanentRedirect } from "next/navigation";

import { authenticatedLegacyRedirect } from "@/lib/auth/account-gate";

/** Legacy about page → Commonhall landing. */
export default function AboutRedirect() {
  permanentRedirect(authenticatedLegacyRedirect("/about") ?? "/");
}
