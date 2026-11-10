import { createHash } from "node:crypto";

export const strongEtagOf = (body: unknown): string =>
  `"${createHash("sha256").update(JSON.stringify(body)).digest("base64url")}"`;

export const matchesIfNoneMatch = (header: string | undefined, etag: string): boolean => {
  if (header === undefined) return false;
  if (header.trim() === "*") return true;
  return header
    .split(",")
    .map((candidate) => candidate.trim().replace(/^W\//, ""))
    .includes(etag);
};
