import { getFeaturedTopic } from "@/domain/selectors";
import { Button } from "@/components/ui/button";
import { fixtureCatalog } from "@/fixtures";

export default function Home() {
  const featuredTopic = getFeaturedTopic(fixtureCatalog);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-6 px-6 py-16">
      <p className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
        Proposed project · Phase 1 prototype
      </p>
      <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        Open-Source Think Tank
      </h1>
      <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
        A demonstration of how a nonpartisan, evidence-aware public process could
        move from open consultation to a published decision record. All people,
        evidence, votes, and decisions in this prototype are synthetic. This is a
        demonstration of a proposed project. It does not claim that an
        organization is incorporated, tax-exempt, legally reviewed, or accepting
        members.
      </p>
      <section className="max-w-2xl space-y-2 border-t border-border pt-6">
        <h2 className="text-lg font-medium text-foreground">
          Featured synthetic topic
        </h2>
        <p className="text-base leading-7 text-muted-foreground">
          {featuredTopic.title}. {featuredTopic.question}
        </p>
        <p className="text-sm text-muted-foreground">
          Current stage: {featuredTopic.stage}. Data source: validated fixtures
          only.
        </p>
      </section>
      <div className="flex flex-wrap gap-3">
        <Button type="button" size="lg" disabled>
          Explore the demo (coming next)
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Build contract: see{" "}
        <code className="text-foreground">docs/product-charter.md</code> and{" "}
        <code className="text-foreground">
          docs/open-source-think-tank-mvp-plan.md
        </code>
        .
      </p>
    </main>
  );
}
