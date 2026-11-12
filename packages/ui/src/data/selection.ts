type PageSelectionState = "none" | "some" | "all";

function toggleId(selected: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(selected);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

function pageSelectionState(
  selected: ReadonlySet<string>,
  pageIds: readonly string[],
): PageSelectionState {
  const count = pageIds.filter((id) => selected.has(id)).length;
  if (count === 0) return "none";
  return count === pageIds.length ? "all" : "some";
}

function togglePage(selected: ReadonlySet<string>, pageIds: readonly string[]): Set<string> {
  const next = new Set(selected);
  if (pageSelectionState(selected, pageIds) === "all") {
    for (const id of pageIds) next.delete(id);
  } else {
    for (const id of pageIds) next.add(id);
  }
  return next;
}

export { pageSelectionState, toggleId, togglePage };
export type { PageSelectionState };
