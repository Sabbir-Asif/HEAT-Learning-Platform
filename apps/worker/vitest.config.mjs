import { nodePreset } from "@heat/config/vitest";

export default nodePreset({
  coverageExclude: [
    "src/queues.ts",
    "src/certificate/certificate-consumer.ts",
    "src/email/email-consumer.ts",
    "src/email/prisma-email-delivery-store.ts",
    "src/email/prisma-certificate-file-lookup.ts",
    "src/cleanup/prisma-expiry-store.ts",
    "src/cleanup/redis-expiry-metric.ts",
    "src/media/prisma-media-cleanup-store.ts",
    "src/media/prisma-storage-cleanup-store.ts",
    "src/news/prisma-news-publication-store.ts",
    "src/outbox/outbox-relay.runner.ts",
    "src/outbox/prisma-outbox-store.ts",
    "src/transcode/transcode-consumer.ts",
  ],
});
