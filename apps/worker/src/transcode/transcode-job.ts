import type { VideoFailureReason } from "@heat/contracts";
import { join } from "node:path";
import type { FfmpegRunner } from "./ffmpeg-runner";
import type { HlsFilesystem } from "./hls-filesystem";
import { publishDirectory, stagingPath } from "./hls-publish";
import type { Publication } from "./hls-publish";
import { buildMasterPlaylist, buildRenditionArgs, renditionsForSource } from "./ladder";
import type { Rendition } from "./ladder";
import type { CodecProbe, SourceInfo, SourceProbe } from "./media-probe";
import { MASTER_FILE, collectOutput } from "./output-collector";
import { validateOutput } from "./output-validation";
import { transcodeTimeoutMs } from "./transcode-timeout";
import type { TimeoutPolicy } from "./transcode-timeout";

export interface RenditionRecord {
  label: string;
  bitrateKbps: number;
}

export interface ReadyResult {
  durationSeconds: number;
  renditions: RenditionRecord[];
}

export interface TranscodeStore {
  claim(assetId: string): Promise<{ assetKey: string } | null>;
  markReady(assetId: string, result: ReadyResult): Promise<boolean>;
  markFailed(assetId: string, reason: VideoFailureReason): Promise<void>;
}

export interface TranscodeSettings {
  uploadDirectory: string;
  hlsDirectory: string;
  timeout: TimeoutPolicy;
}

export interface TranscodeDependencies {
  store: TranscodeStore;
  source: SourceProbe;
  codecs: CodecProbe;
  ffmpeg: FfmpegRunner;
  filesystem: HlsFilesystem;
  newAttemptId: () => string;
  nowMs: () => number;
}

export type TranscodeOutcome =
  | { status: "skipped" }
  | { status: "ready" }
  | { status: "retry"; reason: VideoFailureReason }
  | { status: "failed"; reason: VideoFailureReason };

interface Failure {
  reason: VideoFailureReason;
  retryable: boolean;
}

type AttemptResult =
  { failure: null; ready: ReadyResult; publication: Publication } | { failure: Failure };

const safeKey = /^[A-Za-z0-9_-]{32}$/;

const failure = (reason: VideoFailureReason, retryable: boolean): { failure: Failure } => ({
  failure: { reason, retryable },
});

const bitrateOf = (rendition: Rendition, hasAudio: boolean): number =>
  rendition.videoKbps + (hasAudio ? rendition.audioKbps : 0);

export class TranscodeJob {
  constructor(
    private readonly dependencies: TranscodeDependencies,
    private readonly settings: TranscodeSettings,
  ) {}

  async run(assetId: string, finalAttempt: boolean): Promise<TranscodeOutcome> {
    const { store, filesystem, newAttemptId } = this.dependencies;
    const asset = await store.claim(assetId);
    if (asset === null) return { status: "skipped" };
    const attemptId = newAttemptId();
    const staging = stagingPath(this.settings.hlsDirectory, asset.assetKey, attemptId);
    try {
      return await this.conclude(assetId, asset.assetKey, staging, attemptId, finalAttempt);
    } catch (error) {
      if (finalAttempt) await store.markFailed(assetId, "ENCODE_FAILED").catch(() => undefined);
      throw error;
    } finally {
      await filesystem.remove(staging).catch(() => undefined);
    }
  }

  private async conclude(
    assetId: string,
    assetKey: string,
    staging: string,
    attemptId: string,
    finalAttempt: boolean,
  ): Promise<TranscodeOutcome> {
    const { store } = this.dependencies;
    const result = await this.attempt(assetKey, staging, attemptId);
    if (result.failure === null) {
      let applied: boolean;
      try {
        applied = await store.markReady(assetId, result.ready);
      } catch (error) {
        await result.publication.rollback();
        throw error;
      }
      if (!applied) {
        await result.publication.rollback();
        return { status: "skipped" };
      }
      await result.publication.commit();
      return { status: "ready" };
    }
    if (result.failure.retryable && !finalAttempt) {
      return { status: "retry", reason: result.failure.reason };
    }
    await store.markFailed(assetId, result.failure.reason);
    return { status: "failed", reason: result.failure.reason };
  }

  private async attempt(
    assetKey: string,
    staging: string,
    attemptId: string,
  ): Promise<AttemptResult> {
    if (!safeKey.test(assetKey)) return failure("SOURCE_UNREADABLE", false);
    const input = join(this.settings.uploadDirectory, `${assetKey}.orig`);
    let source: SourceInfo | null;
    try {
      source = await this.dependencies.source.probe(input);
    } catch {
      return failure("SOURCE_UNREADABLE", true);
    }
    if (source === null) return failure("SOURCE_UNREADABLE", false);
    const renditions = renditionsForSource(source);
    const built = await this.build(input, staging, source, renditions);
    if (built !== null) return built;
    const hasAudio = source.hasAudio;
    const names = renditions.map((rendition) => rendition.name);
    try {
      const snapshot = await collectOutput(
        this.dependencies.filesystem,
        this.dependencies.codecs,
        staging,
        names,
      );
      const problems = validateOutput(
        { renditionNames: names, sourceDurationSeconds: source.durationSeconds, hasAudio },
        snapshot,
      );
      if (problems.length > 0) return failure("VALIDATION_FAILED", false);
    } catch {
      return failure("VALIDATION_FAILED", true);
    }
    let publication: Publication;
    try {
      publication = await publishDirectory(
        this.dependencies.filesystem,
        this.settings.hlsDirectory,
        assetKey,
        staging,
        attemptId,
      );
    } catch {
      return failure("PUBLISH_FAILED", true);
    }
    return {
      failure: null,
      publication,
      ready: {
        durationSeconds: Math.round(source.durationSeconds),
        renditions: renditions.map((rendition) => ({
          label: rendition.name,
          bitrateKbps: bitrateOf(rendition, hasAudio),
        })),
      },
    };
  }

  private async build(
    input: string,
    staging: string,
    source: SourceInfo,
    renditions: readonly Rendition[],
  ): Promise<{ failure: Failure } | null> {
    const { filesystem, ffmpeg, nowMs } = this.dependencies;
    const deadline = nowMs() + transcodeTimeoutMs(source.durationSeconds, this.settings.timeout);
    try {
      for (const rendition of renditions) {
        await filesystem.makeDirectory(join(staging, rendition.name));
        const remaining = deadline - nowMs();
        if (remaining <= 0) return failure("TIMED_OUT", false);
        const args = buildRenditionArgs(rendition, {
          input,
          outputDir: staging,
          fps: source.fps,
        });
        const result = await ffmpeg.run(args, remaining);
        if (result === "timed-out") return failure("TIMED_OUT", false);
        if (result === "failed") return failure("ENCODE_FAILED", true);
      }
      await filesystem.writeText(
        join(staging, MASTER_FILE),
        buildMasterPlaylist(renditions, { audio: source.hasAudio }),
      );
    } catch {
      return failure("ENCODE_FAILED", true);
    }
    return null;
  }
}
