import { redirect } from "next/navigation";

type PageProps = { params: Promise<{ slug: string }> };

export default async function AgendaSlugRedirect({ params }: PageProps) {
  const { slug } = await params;
  redirect(`/agenda/topics/${slug}`);
}
