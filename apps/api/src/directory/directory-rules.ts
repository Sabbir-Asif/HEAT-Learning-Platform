import { assertNotInUse, RecordInUseError } from "@heat/db";
import { ApiException } from "../http/api-exception";

export const errorCodeOf = (error: unknown): unknown =>
  typeof error === "object" && error !== null ? (error as { code?: unknown }).code : undefined;

export const plural = (count: number, singular: string, many: string): string =>
  `${count} ${count === 1 ? singular : many}`;

export const joinPhrases = (phrases: readonly string[]): string =>
  phrases.length <= 1
    ? (phrases[0] ?? "")
    : `${phrases.slice(0, -1).join(", ")} and ${phrases[phrases.length - 1]}`;

export const deleteBlockedMessage = (
  subject: string,
  usages: ReadonlyArray<{ name: string; count: number }>,
): string | null => {
  try {
    assertNotInUse(usages);
    return null;
  } catch (error) {
    if (error instanceof RecordInUseError) {
      return `This ${subject} is used by ${joinPhrases(error.blockers.map((blocker) => blocker.name))}, so it cannot be deleted.`;
    }
    throw error;
  }
};

export const translateDirectoryError = (error: unknown): unknown => {
  if (error instanceof ApiException) return error;
  if (errorCodeOf(error) === "P2002") return new ApiException(409, "DIRECTORY_NAME_TAKEN");
  if (errorCodeOf(error) === "P2025") return new ApiException(404, "NOT_FOUND");
  return error;
};
