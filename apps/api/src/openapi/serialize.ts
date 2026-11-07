function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, child]) => [key, sortKeys(child)]),
    );
  }
  return value;
}

/** Stable JSON: object keys sorted at every depth, array order kept, two spaces, one final newline. */
export function serializeDocument(document: unknown): string {
  return `${JSON.stringify(sortKeys(document), null, 2)}\n`;
}
