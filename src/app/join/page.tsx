import type { Metadata } from "next";

import { ShellPlaceholder } from "@/components/ShellPlaceholder";

export const metadata: Metadata = {
  title: "Join preview",
};

export default function JoinPage() {
  return (
    <ShellPlaceholder
      breadcrumbLabel="Join preview"
      title="Join preview"
      description="A nonfunctional walkthrough of eligibility, verification, conduct, and privacy steps will live here."
    />
  );
}
