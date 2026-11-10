export type AuditJson =
  null | string | number | boolean | AuditJson[] | { [key: string]: AuditJson };

export const redactedMarker = "[REDACTED]";

const maxDepth = 8;

const sensitiveKey =
  /password|passwd|secret|token|cookie|authorization|credential|apikey|privatekey|recovery|otp|hash|digest|signature/i;

const normalise = (key: string): string => key.replace(/[^A-Za-z0-9]/g, "");

const isSensitive = (key: string): boolean => sensitiveKey.test(normalise(key));

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
  if (depth >= maxDepth) return redactedMarker;
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
