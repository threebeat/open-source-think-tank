import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { requireMemberSession } from "@/lib/auth/guard";
import { isElevatedPortalEnabled } from "@/lib/v2/flags";

export const dynamic = "force-dynamic";

/**
 * Elevated organization portal is not a Phase 2 product. Community
 * membership is never authorization for `/org/**` (URL is never authority).
 */
export default async function OrgPortalLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireMemberSession();
  if (!isElevatedPortalEnabled()) {
    redirect("/account");
  }
  return children;
}
