import { ApiException } from "../http/api-exception";
import type { OrderStep } from "./module-rules";

export const assertTagMutable = (tag: { isSystem: boolean }): void => {
  if (tag.isSystem) throw new ApiException(409, "TAG_RESERVED");
};

export const nextDisplayOrder = (highest: number | null): number => (highest ?? 0) + 1;

export const planTagSet = (
  currentIds: string[],
  requestedIds: string[],
): { add: string[]; remove: string[] } => {
  const current = new Set(currentIds);
  const requested = new Set(requestedIds);
  return {
    add: requestedIds.filter((id) => !current.has(id)),
    remove: currentIds.filter((id) => !requested.has(id)),
  };
};

export const denseOrder = (orderedIds: string[]): OrderStep[] =>
  orderedIds.map((id, index) => ({ id, order: index + 1 }));

export const deletedTagSlug = (slug: string, id: string): string => `${slug}~${id}`;
