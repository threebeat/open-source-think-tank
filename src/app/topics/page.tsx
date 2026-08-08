import type { Metadata } from "next";

import { ShellPlaceholder } from "@/components/ShellPlaceholder";

export const metadata: Metadata = {
  title: "Topics",
};

export default function TopicsPage() {
  return (
    <ShellPlaceholder
      breadcrumbLabel="Topics"
      title="Topics"
      description="Searchable synthetic topics and evidence views will live here."
    />
  );
}
