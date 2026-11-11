import type { ReorderRequest } from "@heat/contracts";
import { ApiException } from "../http/api-exception";

export interface OrderStep {
  id: string;
  order: number;
}

export interface OrderPlan {
  parking: OrderStep[];
  final: OrderStep[];
}

export const assertContentUnlocked = (lockedAt: Date | null): void => {
  if (lockedAt !== null) throw new ApiException(409, "CONTENT_LOCKED");
};

export const nextOrder = (highest: number | null): number => (highest ?? 0) + 1;

export const planResequence = (orderedIds: string[]): OrderPlan => ({
  parking: orderedIds.map((id, index) => ({ id, order: -(index + 1) })),
  final: orderedIds.map((id, index) => ({ id, order: index + 1 })),
});

const sameSequence = (left: string[], right: string[]): boolean =>
  left.length === right.length && left.every((id, index) => id === right[index]);

export const planReorder = (
  currentIds: string[],
  request: Pick<ReorderRequest, "previousIds" | "orderedIds">,
): OrderPlan => {
  if (!sameSequence(currentIds, request.previousIds)) {
    throw new ApiException(409, "ORDER_CONFLICT");
  }
  const known = new Set(currentIds);
  const requested = new Set(request.orderedIds);
  const isPermutation =
    request.orderedIds.length === currentIds.length &&
    requested.size === currentIds.length &&
    request.orderedIds.every((id) => known.has(id));
  if (!isPermutation) {
    throw new ApiException(400, "VALIDATION_FAILED", undefined, undefined, [
      { path: "orderedIds", code: "invalid" },
    ]);
  }
  return planResequence(request.orderedIds);
};
