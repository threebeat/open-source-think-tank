/** Pure grouping helper — safe for server and client modules. */

export function groupEvidenceByRelationship<T extends { relationship: string }>(
  items: T[],
): { supporting: T[]; counterevidence: T[] } {
  return {
    supporting: items.filter((item) => item.relationship === "supporting"),
    counterevidence: items.filter(
      (item) => item.relationship === "counterevidence",
    ),
  };
}
