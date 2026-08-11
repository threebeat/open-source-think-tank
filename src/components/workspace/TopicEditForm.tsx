"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type TopicEditFormProps = {
  topicId: string;
  initialTitle: string;
  initialQuestion: string;
  initialBackground: string;
  initialScope: string;
  expectedUpdatedAt: string;
  editable: boolean;
};

export function TopicEditForm({
  topicId,
  initialTitle,
  initialQuestion,
  initialBackground,
  initialScope,
  expectedUpdatedAt,
  editable,
}: TopicEditFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [question, setQuestion] = useState(initialQuestion);
  const [background, setBackground] = useState(initialBackground);
  const [scope, setScope] = useState(initialScope);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!editable) {
    return (
      <p className="text-sm text-muted-foreground">
        Metadata editing is limited to draft topics in this package. Workflow
        transitions do not edit title, question, background, or scope.
      </p>
    );
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/workspace/topics/${topicId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title,
          question,
          background,
          scope,
          expectedUpdatedAt,
        }),
      });
      const data = (await response.json()) as { error?: string; code?: string };
      if (!response.ok) {
        if (response.status === 409) {
          setError(
            "This topic changed elsewhere. Reload the page and try again.",
          );
        } else {
          setError(data.error ?? "Could not update topic");
        }
        return;
      }
      router.refresh();
    } catch {
      setError("Could not update topic");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-4" noValidate>
      {error ? (
        <div
          className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      <label className="block space-y-2 text-sm">
        <span>Title</span>
        <input
          className="w-full rounded-md border border-border bg-background px-3 py-2"
          value={title}
          maxLength={200}
          required
          onChange={(event) => setTitle(event.target.value)}
        />
      </label>
      <label className="block space-y-2 text-sm">
        <span>Question</span>
        <textarea
          className="w-full rounded-md border border-border bg-background px-3 py-2"
          rows={3}
          value={question}
          maxLength={2000}
          required
          onChange={(event) => setQuestion(event.target.value)}
        />
      </label>
      <label className="block space-y-2 text-sm">
        <span>Background</span>
        <textarea
          className="w-full rounded-md border border-border bg-background px-3 py-2"
          rows={5}
          value={background}
          maxLength={8000}
          required
          onChange={(event) => setBackground(event.target.value)}
        />
      </label>
      <label className="block space-y-2 text-sm">
        <span>Scope</span>
        <textarea
          className="w-full rounded-md border border-border bg-background px-3 py-2"
          rows={3}
          value={scope}
          maxLength={4000}
          required
          onChange={(event) => setScope(event.target.value)}
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 items-center rounded-md bg-foreground px-4 text-sm text-background disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save metadata"}
      </button>
    </form>
  );
}
