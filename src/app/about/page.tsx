import type { Metadata } from "next";

import { ShellPlaceholder } from "@/components/ShellPlaceholder";

export const metadata: Metadata = {
  title: "About",
};

export default function AboutPage() {
  return (
    <ShellPlaceholder
      breadcrumbLabel="About"
      title="About"
      description="Project description, openness commitments, limitations, and a contact placeholder will live here."
    />
  );
}
