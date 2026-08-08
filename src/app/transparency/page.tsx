import type { Metadata } from "next";

import { ShellPlaceholder } from "@/components/ShellPlaceholder";

export const metadata: Metadata = {
  title: "Transparency",
};

export default function TransparencyPage() {
  return (
    <ShellPlaceholder
      breadcrumbLabel="Transparency"
      title="Transparency"
      description="Audit events, method versions, and open-versus-protected data guidance will live here."
    />
  );
}
