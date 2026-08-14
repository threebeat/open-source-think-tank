"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import type { MemberCreateCategory } from "@/lib/commons/categories";
import { cn } from "@/lib/utils";

type CreatePostFormProps = {
  categories: Array<{ value: MemberCreateCategory; label: string }>;
};

export function CreatePostForm({ categories }: CreatePostFormProps) {
  const router = useRouter();
  const formId = useId();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<MemberCreateCategory>(
    categories[0]?.value ?? "general_discussion",
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/commons/posts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, body, category }),
      });
      const data = (await response.json()) as {
        error?: string;
        publicId?: string;
      };
      if (!response.ok) {
        setError(data.error ?? "Could not create the post.");
        return;
      }
      if (data.publicId) {
        router.push(`/commons/discussions/${data.publicId}`);
        router.refresh();
        return;
      }
      router.replace("/commons");
      router.refresh();
    } catch {
      setError("Could not create the post.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="max-w-xl space-y-5"
      aria-labelledby={`${formId}-heading`}
    >
      <h2 id={`${formId}-heading`} className="font-heading text-xl tracking-tight">
        Create a post
      </h2>
      <p className="text-sm text-muted-foreground">
        Community members may post in informal categories only. Formal Commons
        listings require qualification. Posting does not grant Chamber, Council,
        moderator, or organization-admin authority.
      </p>
      <label className="block space-y-2 text-sm" htmlFor={`${formId}-category`}>
        <span>Category</span>
        <select
          id={`${formId}-category`}
          className="w-full min-h-11 rounded-md border border-border bg-background px-3 py-2"
          name="category"
          required
          value={category}
          onChange={(event) =>
            setCategory(event.target.value as MemberCreateCategory)
          }
        >
          {categories.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block space-y-2 text-sm" htmlFor={`${formId}-title`}>
        <span>Title</span>
        <input
          id={`${formId}-title`}
          className="w-full min-h-11 rounded-md border border-border bg-background px-3 py-2"
          name="title"
          required
          maxLength={200}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
      </label>
      <label className="block space-y-2 text-sm" htmlFor={`${formId}-body`}>
        <span>Body</span>
        <textarea
          id={`${formId}-body`}
          className="w-full min-h-32 rounded-md border border-border bg-background px-3 py-2"
          name="body"
          required
          maxLength={20_000}
          value={body}
          onChange={(event) => setBody(event.target.value)}
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className={cn(buttonVariants({ size: "lg" }), "min-h-11 disabled:opacity-50")}
      >
        {pending ? "Posting…" : "Create post"}
      </button>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
