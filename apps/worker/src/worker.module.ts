import { Module } from "@nestjs/common";
import { CoreModule, WorkerMailConnectionCheck } from "api/core";
import { CertificateConsumer } from "./certificate/certificate-consumer";
import { EmailConsumer } from "./email/email-consumer";
import { TranscodeConsumer } from "./transcode/transcode-consumer";
import { VideoProbeConsumer } from "./transcode/video-probe-consumer";
import { MediaCleanupRunner } from "./media/media-cleanup.runner";
import { OutboxRelayRunner } from "./outbox/outbox-relay.runner";

@Module({
  imports: [CoreModule],
  providers: [
    WorkerMailConnectionCheck,
    OutboxRelayRunner,
    MediaCleanupRunner,
    EmailConsumer,
    CertificateConsumer,
    VideoProbeConsumer,
    TranscodeConsumer,
  ],
})
export class WorkerModule {}
