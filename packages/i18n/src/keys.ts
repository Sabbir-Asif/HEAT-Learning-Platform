export type Catalog = { [key: string]: string | Catalog };

export function flattenKeys(catalog: Catalog, prefix = ""): Record<string, string> {
  const entries = Object.entries(catalog).flatMap(([key, value]): [string, string][] => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === "string" ? [[path, value]] : Object.entries(flattenKeys(value, path));
  });
  return Object.fromEntries(entries.sort(([a], [b]) => a.localeCompare(b)));
}

export function compareKeys(reference: Catalog, candidate: Catalog) {
  const expected = Object.keys(flattenKeys(reference));
  const actual = new Set(Object.keys(flattenKeys(candidate)));
  return {
    missing: expected.filter((key) => !actual.has(key)),
    extra: [...actual].filter((key) => !expected.includes(key)).sort(),
  };
}
