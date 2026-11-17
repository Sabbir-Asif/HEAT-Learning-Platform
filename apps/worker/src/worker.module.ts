import { Module } from "@nestjs/common";
import { ExpiryRunner } from "./cleanup";
import { CoreModule, InsightsRollupService, WorkerMailConnectionCheck } from "api/core";
import { CertificateConsumer } from "./certificate/certificate-consumer";
import { EmailConsumer } from "./email/email-consumer";
import { TranscodeConsumer } from "./transcode/transcode-consumer";
import { VideoProbeConsumer } from "./transcode/video-probe-consumer";
import { InsightsRollupRunner } from "./insights/insights-rollup.runner";
import { MediaCleanupRunner } from "./media/media-cleanup.runner";
import { StorageCleanupRunner } from "./media/storage-cleanup.runner";
import { NewsPublicationRunner } from "./news/news-publication.runner";
import { OutboxRelayRunner } from "./outbox/outbox-relay.runner";

@Module({
  imports: [CoreModule],
  providers: [
    WorkerMailConnectionCheck,
    OutboxRelayRunner,
    ExpiryRunner,
    NewsPublicationRunner,
    InsightsRollupService,
    InsightsRollupRunner,
    MediaCleanupRunner,
    StorageCleanupRunner,
    EmailConsumer,
    CertificateConsumer,
    VideoProbeConsumer,
    TranscodeConsumer,
  ],
})
export class WorkerModule {}
