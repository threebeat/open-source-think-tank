import { permanentRedirect } from "next/navigation";

import { authenticatedLegacyRedirect } from "@/lib/auth/account-gate";

/** Legacy Idea Commons list → Commons. */
export default function IdeaCommonsRedirect() {
  permanentRedirect(authenticatedLegacyRedirect("/idea-commons") ?? "/commons");
}
