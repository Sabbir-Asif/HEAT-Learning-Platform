import type { OutboxStore } from "./outbox-relay";

export const readOutboxLagSeconds = async (
  store: Pick<OutboxStore, "oldestUnrelayedAt">,
  clock: { now(): Date },
): Promise<number> => {
  const oldest = await store.oldestUnrelayedAt();
  if (oldest === null) return 0;
  return Math.max(0, Math.floor((clock.now().getTime() - oldest.getTime()) / 1000));
};
