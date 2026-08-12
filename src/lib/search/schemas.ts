import { z } from "zod";

/** Documented workspace search query length (trimmed). */
export const WORKSPACE_SEARCH_QUERY_MIN = 2;
export const WORKSPACE_SEARCH_QUERY_MAX = 100;
export const WORKSPACE_SEARCH_PAGE_SIZE_MAX = 50;
export const WORKSPACE_SEARCH_PAGE_SIZE_DEFAULT = 20;
/** Hard cap on page number to keep OFFSET bounded. */
export const WORKSPACE_SEARCH_PAGE_MAX = 100;

export const workspaceSearchEntitySchema = z.enum([
  "topics",
  "claims",
  "evidence",
]);

export type WorkspaceSearchEntity = z.infer<typeof workspaceSearchEntitySchema>;

export const workspaceSearchQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .min(WORKSPACE_SEARCH_QUERY_MIN)
    .max(WORKSPACE_SEARCH_QUERY_MAX),
  entities: z
    .array(workspaceSearchEntitySchema)
    .min(1)
    .max(3)
    .default(["topics", "claims", "evidence"]),
  page: z.coerce
    .number()
    .int()
    .min(1)
    .max(WORKSPACE_SEARCH_PAGE_MAX)
    .default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(WORKSPACE_SEARCH_PAGE_SIZE_MAX)
    .default(WORKSPACE_SEARCH_PAGE_SIZE_DEFAULT),
});

export type WorkspaceSearchQuery = z.infer<typeof workspaceSearchQuerySchema>;

/**
 * Escape LIKE/ILIKE wildcards so user input is matched literally.
 * PostgreSQL default ESCAPE is backslash when using ESCAPE '\'.
 */
export function escapeIlikePattern(raw: string): string {
  return raw.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

export function ilikeContainsPattern(trimmedQuery: string): string {
  return `%${escapeIlikePattern(trimmedQuery)}%`;
}
