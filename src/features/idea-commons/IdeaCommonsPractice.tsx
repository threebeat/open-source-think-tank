"use client";

import { useId, useState, useSyncExternalStore, type FormEvent } from "react";

import { DisclosureNotice } from "@/components/DisclosureNotice";
import { Button } from "@/components/ui/button";
import {
  addIdeaCommonsPracticePost,
  getIdeaCommonsPracticeState,
  getServerIdeaCommonsPracticeState,
  subscribeIdeaCommons,
} from "@/features/idea-commons/idea-commons-storage";
import { journeyInformalNotice } from "@/fixtures/journey-catalog";

type Props = {
  parentId?: string | null;
  heading?: string;
};

export function IdeaCommonsPractice({
  parentId = null,
  heading = "Practice an Idea Commons contribution",
}: Props) {
  const titleId = useId();
  const bodyId = useId();
  const sourceId = useId();
  const liveId = useId();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [citedSourceTitle, setCitedSourceTitle] = useState("");
  const [kind, setKind] = useState<"discussion" | "proposal" | "reply">(
    parentId ? "reply" : "discussion",
  );
  const [announcement, setAnnouncement] = useState("");
  const state = useSyncExternalStore(
    subscribeIdeaCommons,
    getIdeaCommonsPracticeState,
    getServerIdeaCommonsPracticeState,
  );

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim() || !body.trim()) {
      setAnnouncement("Title and body are required for a practice post.");
      return;
    }
    const post = addIdeaCommonsPracticePost({
      kind,
      title: title.trim(),
      body: body.trim(),
      citedSourceTitle: citedSourceTitle.trim(),
      parentId,
    });
    setTitle("");
    setBody("");
    setCitedSourceTitle("");
    setAnnouncement(
      `Saved local practice ${post.kind} “${post.title}”. Session-only; cleared by Reset.`,
    );
  }

  function convertDiscussionToProposal() {
    if (!title.trim() || !body.trim()) {
      setTitle(title || "Practice proposal from discussion");
      setBody(body || "Converted from an Idea Commons discussion contribution.");
      setKind("proposal");
      setAnnouncement(
        "Switched to proposal mode. Submit to save a local unqualified proposal.",
      );
      return;
    }
    setKind("proposal");
    const post = addIdeaCommonsPracticePost({
      kind: "proposal",
      title: title.trim(),
      body: body.trim(),
      citedSourceTitle: citedSourceTitle.trim(),
      parentId,
    });
    setTitle("");
    setBody("");
    setCitedSourceTitle("");
    setAnnouncement(
      `Converted to local practice proposal “${post.title}”. Still informal — not in the Formal Topic Pipeline.`,
    );
  }

  return (
    <section className="space-y-4" aria-labelledby={titleId}>
      <h2 id={titleId} className="font-heading text-xl text-foreground">
        {heading}
      </h2>
      <DisclosureNotice title="Informal practice only" tone="caution">
        {journeyInformalNotice} Posts stay in this browser session. Nothing is
        transmitted to a server, Pol.is, or the gated alpha.
      </DisclosureNotice>
      <p id={liveId} className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
      {announcement ? (
        <p className="text-sm text-muted-foreground" aria-hidden="true">
          {announcement}
        </p>
      ) : null}
      <form className="space-y-4" onSubmit={submit}>
        <div className="flex flex-wrap gap-3">
          {(
            [
              ["discussion", "Discussion"],
              ["proposal", "Proposal"],
              ["reply", "Reply"],
            ] as const
          ).map(([value, label]) => (
            <label
              key={value}
              className="inline-flex min-h-11 items-center gap-2 text-sm"
            >
              <input
                type="radio"
                name="idea-commons-kind"
                value={value}
                checked={kind === value}
                onChange={() => setKind(value)}
                className="size-4"
              />
              {label}
            </label>
          ))}
        </div>
        <div className="space-y-2">
          <label htmlFor={`${titleId}-field`} className="text-sm font-medium">
            Title
          </label>
          <input
            id={`${titleId}-field`}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="min-h-11 w-full rounded-md border border-border bg-background px-3 text-base"
            autoComplete="off"
          />
        </div>
        <div className="space-y-2">
          <label htmlFor={bodyId} className="text-sm font-medium">
            Contribution
          </label>
          <textarea
            id={bodyId}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={4}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-base"
          />
        </div>
        <div className="space-y-2">
          <label htmlFor={sourceId} className="text-sm font-medium">
            Cite a source (title only in practice)
          </label>
          <input
            id={sourceId}
            value={citedSourceTitle}
            onChange={(event) => setCitedSourceTitle(event.target.value)}
            className="min-h-11 w-full rounded-md border border-border bg-background px-3 text-base"
            autoComplete="off"
            placeholder="Optional source title — do not paste secret URLs"
          />
        </div>
        <div className="flex flex-wrap gap-3">
          <Button type="submit" size="lg" className="min-h-11">
            Save practice post
          </Button>
          <Button
            type="button"
            size="lg"
            variant="outline"
            className="min-h-11"
            onClick={convertDiscussionToProposal}
          >
            Convert to proposal
          </Button>
        </div>
      </form>
      {state.posts.length > 0 ? (
        <div className="space-y-3">
          <h3 className="font-heading text-lg text-foreground">
            Your local practice posts
          </h3>
          <ul className="space-y-3">
            {state.posts.map((post) => (
              <li
                key={post.id}
                className="rounded-md border border-dashed border-border px-4 py-3"
              >
                <p className="text-xs font-medium tracking-wide text-primary uppercase">
                  Local practice · {post.kind} · informal
                </p>
                <p className="mt-1 font-medium text-foreground">{post.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{post.body}</p>
                {post.citedSourceTitle ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Cited source title: {post.citedSourceTitle}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
