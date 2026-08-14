import { requireMemberSession } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

export default async function MemberLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireMemberSession();
  return children;
}
