import { permanentRedirect } from "next/navigation";

import { authenticatedLegacyRedirect } from "@/lib/auth/account-gate";

/** Legacy Public Record / transparency → Records. */
export default function TransparencyRedirect() {
  permanentRedirect(authenticatedLegacyRedirect("/transparency") ?? "/records");
}
