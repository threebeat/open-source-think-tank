"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type FieldErrors = Partial<
  Record<"slug" | "title" | "question" | "background" | "scope" | "form", string>
>;

export function TopicCreateForm() {
  const router = useRouter();
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [question, setQuestion] = useState("");
  const [background, setBackground] = useState("");
  const [scope, setScope] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setErrors({});
    try {
      const response = await fetch("/api/workspace/topics", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug, title, question, background, scope }),
      });
      const data = (await response.json()) as {
        error?: string;
        code?: string;
        slug?: string;
      };
      if (!response.ok) {
        setErrors({ form: data.error ?? "Could not create topic" });
        return;
      }
      router.push(`/workspace/topics/${data.slug}`);
      router.refresh();
    } catch {
      setErrors({ form: "Could not create topic" });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-4" noValidate>
      <p id="topic-create-errors" className="sr-only" aria-live="polite">
        {errors.form ?? ""}
      </p>
      {errors.form ? (
        <div
          className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          role="alert"
          aria-describedby="topic-create-errors"
        >
          {errors.form}
        </div>
      ) : null}

      <div className="space-y-2 text-sm">
        <label htmlFor="topic-slug" className="block">
          Slug (lowercase ASCII, hyphens allowed)
        </label>
        <input
          id="topic-slug"
          className="w-full rounded-md border border-border bg-background px-3 py-2"
          name="slug"
          value={slug}
          maxLength={80}
          required
          aria-invalid={Boolean(errors.slug)}
          onChange={(event) => setSlug(event.target.value)}
        />
        <span className="text-xs text-muted-foreground">{slug.length}/80</span>
      </div>

      <div className="space-y-2 text-sm">
        <label htmlFor="topic-title" className="block">
          Title
        </label>
        <input
          id="topic-title"
          className="w-full rounded-md border border-border bg-background px-3 py-2"
          name="title"
          value={title}
          maxLength={200}
          required
          onChange={(event) => setTitle(event.target.value)}
        />
        <span className="text-xs text-muted-foreground">{title.length}/200</span>
      </div>

      <div className="space-y-2 text-sm">
        <label htmlFor="topic-question" className="block">
          Question
        </label>
        <textarea
          id="topic-question"
          className="w-full rounded-md border border-border bg-background px-3 py-2"
          name="question"
          rows={3}
          value={question}
          maxLength={2000}
          required
          onChange={(event) => setQuestion(event.target.value)}
        />
        <span className="text-xs text-muted-foreground">
          {question.length}/2000
        </span>
      </div>

      <div className="space-y-2 text-sm">
        <label htmlFor="topic-background" className="block">
          Background
        </label>
        <textarea
          id="topic-background"
          className="w-full rounded-md border border-border bg-background px-3 py-2"
          name="background"
          rows={5}
          value={background}
          maxLength={8000}
          required
          onChange={(event) => setBackground(event.target.value)}
        />
        <span className="text-xs text-muted-foreground">
          {background.length}/8000
        </span>
      </div>

      <div className="space-y-2 text-sm">
        <label htmlFor="topic-scope" className="block">
          Scope
        </label>
        <textarea
          id="topic-scope"
          className="w-full rounded-md border border-border bg-background px-3 py-2"
          name="scope"
          rows={3}
          value={scope}
          maxLength={4000}
          required
          onChange={(event) => setScope(event.target.value)}
        />
        <span className="text-xs text-muted-foreground">
          {scope.length}/4000
        </span>
      </div>

      <p className="text-sm text-muted-foreground">
        New topics always start as Draft and Not published. Actor, creator, and
        synthetic classification are derived from your session — not from this
        form.
      </p>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 items-center rounded-md bg-foreground px-4 text-sm text-background disabled:opacity-60"
      >
        {pending ? "Creating…" : "Create draft topic"}
      </button>
    </form>
  );
}
