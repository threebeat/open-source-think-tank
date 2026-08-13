import { redirect } from "next/navigation";

/**
 * Legacy Topics list entry → canonical Formal Topics list.
 * Workspace authoring remains under /workspace/topics.
 */
export default function TopicsPage() {
  redirect("/formal-topics");
}
