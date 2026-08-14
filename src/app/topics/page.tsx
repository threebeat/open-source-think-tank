import { permanentRedirect } from "next/navigation";

import { authenticatedLegacyRedirect } from "@/lib/auth/account-gate";

/** Legacy Topics list → Public Agenda. Workspace authoring stays under /workspace/topics. */
export default function TopicsRedirect() {
  permanentRedirect(authenticatedLegacyRedirect("/topics") ?? "/agenda");
}
