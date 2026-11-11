import { Module } from "@nestjs/common";
import { CoreModule, WorkerMailConnectionCheck } from "api/core";
import { EmailConsumer } from "./email/email-consumer";
import { VideoProbeConsumer } from "./transcode/video-probe-consumer";
import { OutboxRelayRunner } from "./outbox/outbox-relay.runner";

@Module({
  imports: [CoreModule],
  providers: [WorkerMailConnectionCheck, OutboxRelayRunner, EmailConsumer, VideoProbeConsumer],
})
export class WorkerModule {}
