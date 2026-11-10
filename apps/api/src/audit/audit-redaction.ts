export type AuditJson =
  null | string | number | boolean | AuditJson[] | { [key: string]: AuditJson };

export const redactedMarker = "[REDACTED]";
export const truncatedMarker = "[TRUNCATED]";

const maxDepth = 8;

const sensitiveWords = new Set([
  "password",
  "passwd",
  "secret",
  "token",
  "cookie",
  "authorization",
  "credential",
  "recovery",
  "otp",
  "hash",
  "digest",
  "signature",
  "salt",
  "pin",
  "session",
  "accesskey",
  "apikey",
  "privatekey",
  "pepper",
]);

const tokensOf = (key: string): string[] =>
  key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word !== "");

const singular = (word: string): string => word.replace(/(es|s)$/, "");

const isSensitiveWord = (word: string): boolean =>
  sensitiveWords.has(word) || sensitiveWords.has(singular(word));

const isSensitive = (key: string): boolean => {
  const words = tokensOf(key);
  return (
    words.some(isSensitiveWord) ||
    words.slice(1).some((word, index) => isSensitiveWord(`${words[index]}${word}`))
  );
};

const walk = (value: unknown, depth: number): AuditJson | undefined => {
  if (value === undefined || typeof value === "function" || typeof value === "symbol") {
    return undefined;
  }
  if (value === null) return null;
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value !== "object") {
    return typeof value === "number" && !Number.isFinite(value)
      ? null
      : (value as string | number | boolean);
  }
  if (depth >= maxDepth) return truncatedMarker;
  if (Array.isArray(value)) {
    return value.map((item) => walk(item, depth + 1) ?? null);
  }
  const result: { [key: string]: AuditJson } = {};
  for (const [key, entry] of Object.entries(value)) {
    if (isSensitive(key) && entry !== undefined && typeof entry !== "boolean" && entry !== null) {
      result[key] = redactedMarker;
      continue;
    }
    const walked = walk(entry, depth + 1);
    if (walked !== undefined) result[key] = walked;
  }
  return result;
};

export const redact = (value: unknown): AuditJson => walk(value, 0) ?? null;
