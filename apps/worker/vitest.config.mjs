import { nodePreset } from "@heat/config/vitest";

export default nodePreset({
  coverageExclude: [
    "src/queues.ts",
    "src/email/email-consumer.ts",
    "src/email/prisma-email-delivery-store.ts",
    "src/outbox/outbox-relay.runner.ts",
    "src/outbox/prisma-outbox-store.ts",
  ],
});
