import { compareKeys, flattenKeys, type Catalog } from "./keys";
import { placeholderNames } from "./placeholders";

export interface ParityReport {
  missing: string[];
  extra: string[];
  empty: string[];
  placeholders: string[];
}

const blankKeys = (label: string, catalog: Catalog) =>
  Object.entries(flattenKeys(catalog))
    .filter(([, value]) => value.trim() === "")
    .map(([key]) => `${label}: ${key}`);

const describeNames = (names: string[]) =>
  names.length === 0 ? "none" : names.map((name) => `{${name}}`).join(" ");

export function checkParity(reference: Catalog, candidate: Catalog): ParityReport {
  const { missing, extra } = compareKeys(reference, candidate);
  const referenceMessages = flattenKeys(reference);
  const candidateMessages = flattenKeys(candidate);
  const placeholders = Object.keys(referenceMessages).flatMap((key) => {
    const candidateMessage = candidateMessages[key];
    if (candidateMessage === undefined) return [];
    const expected = placeholderNames(referenceMessages[key] ?? "");
    const actual = placeholderNames(candidateMessage);
    return expected.join(",") === actual.join(",")
      ? []
      : [`${key}: en ${describeNames(expected)}, bn ${describeNames(actual)}`];
  });
  return {
    missing,
    extra,
    empty: [...blankKeys("en", reference), ...blankKeys("bn", candidate)],
    placeholders,
  };
}
