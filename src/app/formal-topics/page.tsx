import { permanentRedirect } from "next/navigation";

import { authenticatedLegacyRedirect } from "@/lib/auth/account-gate";

/** Legacy Formal Topics list → Public Agenda. */
export default function FormalTopicsRedirect() {
  permanentRedirect(authenticatedLegacyRedirect("/formal-topics") ?? "/agenda");
}
