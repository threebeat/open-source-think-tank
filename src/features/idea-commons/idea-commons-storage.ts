export const IDEA_COMMONS_STORAGE_KEY = "ostt-idea-commons-practice";

export type IdeaCommonsPracticePost = {
  id: string;
  kind: "discussion" | "proposal" | "reply";
  title: string;
  body: string;
  citedSourceTitle: string;
  parentId: string | null;
  createdAt: string;
};

export type IdeaCommonsPracticeState = {
  posts: IdeaCommonsPracticePost[];
};

const listeners = new Set<() => void>();
let cached: IdeaCommonsPracticeState | null = null;
const serverSnapshot: IdeaCommonsPracticeState = { posts: [] };

function emit() {
  cached = null;
  for (const listener of listeners) {
    listener();
  }
}

function readRaw(): IdeaCommonsPracticeState {
  if (typeof window === "undefined") {
    return serverSnapshot;
  }
  const raw = window.sessionStorage.getItem(IDEA_COMMONS_STORAGE_KEY);
  if (!raw) {
    return { posts: [] };
  }
  try {
    const parsed = JSON.parse(raw) as IdeaCommonsPracticeState;
    if (!parsed || !Array.isArray(parsed.posts)) {
      return { posts: [] };
    }
    return {
      posts: parsed.posts.filter(
        (post) =>
          typeof post?.id === "string" &&
          typeof post.title === "string" &&
          typeof post.body === "string",
      ),
    };
  } catch {
    return { posts: [] };
  }
}

function writeRaw(state: IdeaCommonsPracticeState) {
  window.sessionStorage.setItem(IDEA_COMMONS_STORAGE_KEY, JSON.stringify(state));
  emit();
}

export function subscribeIdeaCommons(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getIdeaCommonsPracticeState(): IdeaCommonsPracticeState {
  const next = readRaw();
  if (
    cached &&
    cached.posts.length === next.posts.length &&
    cached.posts.every((post, index) => post.id === next.posts[index]?.id)
  ) {
    return cached;
  }
  cached = next;
  return cached;
}

export function getServerIdeaCommonsPracticeState(): IdeaCommonsPracticeState {
  return serverSnapshot;
}

export function addIdeaCommonsPracticePost(
  input: Omit<IdeaCommonsPracticePost, "id" | "createdAt">,
): IdeaCommonsPracticePost {
  const post: IdeaCommonsPracticePost = {
    ...input,
    id: `practice-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
  };
  const current = readRaw();
  writeRaw({ posts: [post, ...current.posts] });
  return post;
}

export function clearIdeaCommonsPractice(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.sessionStorage.removeItem(IDEA_COMMONS_STORAGE_KEY);
  emit();
}
