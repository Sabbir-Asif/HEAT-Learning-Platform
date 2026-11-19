"use client";

import { Container, Hotkey, PlayButton, StatusAnnouncer, createPlayer } from "@videojs/react";
import { HlsJsVideo } from "@videojs/react/media/hlsjs-video";
import { videoFeatures } from "@videojs/react/video";
import { Hls } from "@videojs/hlsjs-video";
import type { HlsJsAdapter } from "@videojs/hlsjs-video";
import { PlayIcon } from "lucide-react";
import * as React from "react";
import { Button } from "../components/button";
import { cn } from "../lib/utils";
import { selectAutoResolutionCap, readConnection } from "./connection-cap";
import {
  bufferConfig,
  captionLabel,
  captionTrackUrl,
  choiceForRendition,
  isForbiddenError,
  playbackRatesUpTo,
  renditionForChoice,
} from "./engine-config";
import { PlayerControls } from "./player-controls";
import { attachProgressEvents, progressIntervalMs } from "./progress-events";
import type { PlayerProgress } from "./watch-tracker";
import {
  automaticChoice,
  browserStorage,
  readBandwidthEstimate,
  readQualityChoice,
  writeBandwidthEstimate,
  writeQualityChoice,
} from "./preferences";
import { createRefreshCoordinator, isRefreshDue, refreshDelayMs } from "./session-refresh";
import type { RefreshedSession } from "./session-refresh";

const { Player, usePlayer } = createPlayer({ features: videoFeatures });

const retryAfterFailedRefreshMs = 30000;
const settleAfterRecoveryMs = 1500;
const bandwidthSaveIntervalMs = 15000;
const enginePollMs = 250;

type Failure = "session" | "playback";

const failureText: Record<Failure, { title: string; description: string }> = {
  session: {
    title: "Your access to this video ended",
    description: "Check your connection and try again. If it keeps failing, sign in again.",
  },
  playback: {
    title: "This video stopped playing",
    description: "Check your connection and try again.",
  },
};

interface VideoPlayerProps {
  title: string;
  manifestPath: string;
  initialExpiresAt: string;
  refreshSession: () => Promise<RefreshedSession>;
  maxPlaybackRate: number;
  startPositionSeconds?: number;
  autoPlay?: boolean;
  captions?: readonly { language: string }[];
  poster?: string;
  onProgress?: (progress: PlayerProgress) => void;
  className?: string;
}

function PlayerSurface({
  title,
  manifestPath,
  initialExpiresAt,
  refreshSession,
  maxPlaybackRate,
  startPositionSeconds = 0,
  autoPlay = false,
  captions = [],
  poster,
  onProgress,
  className,
}: VideoPlayerProps) {
  const store = usePlayer();
  const started = usePlayer((state) => state.started);
  const paused = usePlayer((state) => state.paused);
  const renditions = usePlayer((state) => state.videoRenditionList);
  const mediaRef = React.useRef<HlsJsAdapter>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const storage = React.useState(() => browserStorage())[0];
  const [failure, setFailure] = React.useState<Failure | null>(null);
  const settledAtRef = React.useRef(0);
  const lastErrorTypeRef = React.useRef<string | null>(null);
  const appliedChoiceRef = React.useRef(false);
  const onProgressRef = React.useRef(onProgress);

  React.useEffect(() => {
    onProgressRef.current = onProgress;
  }, [onProgress]);

  const coordinator = React.useMemo(
    () =>
      createRefreshCoordinator({
        refreshSession,
        initialExpiresAt,
      }),
    [refreshSession, initialExpiresAt],
  );

  const [source] = React.useState(() => {
    const estimate = readBandwidthEstimate(storage);
    return {
      src: manifestPath,
      type: "application/vnd.apple.mpegurl",
      maxAutoResolution: selectAutoResolutionCap(readConnection()),
      engine: {
        hlsJs: {
          ...bufferConfig,
          ...(startPositionSeconds > 0 ? { startPosition: startPositionSeconds } : {}),
          ...(estimate ? { abrEwmaDefaultEstimate: estimate } : {}),
        },
      },
    };
  });

  const resume = React.useCallback(() => {
    const video = videoRef.current;
    const engine = mediaRef.current?.engine ?? null;
    const at = video?.currentTime ?? 0;
    settledAtRef.current = Date.now();
    if (engine) {
      if (lastErrorTypeRef.current === Hls.ErrorTypes.MEDIA_ERROR) engine.recoverMediaError();
      else if (engine.levels.length === 0) engine.loadSource(manifestPath);
      else engine.startLoad(at);
      return;
    }
    if (!video) return;
    const wasPlaying = !video.paused;
    video.addEventListener(
      "loadedmetadata",
      () => {
        video.currentTime = at;
        if (wasPlaying) void video.play().catch(() => undefined);
      },
      { once: true },
    );
    video.load();
  }, [manifestPath]);

  const recover = React.useCallback(async () => {
    const outcome = await coordinator.recoverFromForbidden();
    if (outcome === "refused") {
      setFailure("session");
      return;
    }
    setFailure(null);
    resume();
  }, [coordinator, resume]);

  React.useEffect(() => {
    let attached: ReturnType<typeof setInterval> | null = null;
    let detach: (() => void) | null = null;
    const attach = () => {
      const engine = mediaRef.current?.engine ?? null;
      if (!engine) return;
      if (attached) clearInterval(attached);
      attached = null;
      const onError = (
        _event: unknown,
        data: { fatal: boolean; type: string; response?: { code?: number } | undefined },
      ) => {
        if (isForbiddenError(data)) {
          if (Date.now() - settledAtRef.current < settleAfterRecoveryMs) return;
          void recover();
          return;
        }
        if (data.fatal) {
          lastErrorTypeRef.current = data.type;
          setFailure("playback");
        }
      };
      engine.on(Hls.Events.ERROR, onError);
      detach = () => engine.off(Hls.Events.ERROR, onError);
    };
    attach();
    if (!detach) attached = setInterval(attach, enginePollMs);
    return () => {
      if (attached) clearInterval(attached);
      detach?.();
    };
  }, [recover]);

  React.useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;
    const schedule = (delay: number) => {
      if (stopped) return;
      timer = setTimeout(run, delay);
    };
    const run = async () => {
      const outcome = await coordinator.refresh();
      schedule(
        outcome === "recovered"
          ? refreshDelayMs(coordinator.window(), Date.now())
          : retryAfterFailedRefreshMs,
      );
    };
    const checkDue = () => {
      if (document.visibilityState !== "visible") return;
      if (!isRefreshDue(coordinator.window(), Date.now())) return;
      if (timer) clearTimeout(timer);
      void run();
    };
    schedule(refreshDelayMs(coordinator.window(), Date.now()));
    document.addEventListener("visibilitychange", checkDue);
    window.addEventListener("online", checkDue);
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", checkDue);
      window.removeEventListener("online", checkDue);
    };
  }, [coordinator]);

  React.useEffect(() => {
    let detach: (() => void) | null = null;
    const attach = (): boolean => {
      const media = videoRef.current;
      if (!media) return false;
      detach = attachProgressEvents({
        media,
        document,
        window,
        maxRate: maxPlaybackRate,
        intervalMs: progressIntervalMs,
        onProgress: (progress) => onProgressRef.current?.(progress),
      });
      return true;
    };
    let poll: ReturnType<typeof setInterval> | null = null;
    if (!attach()) {
      poll = setInterval(() => {
        if (attach() && poll) clearInterval(poll);
      }, enginePollMs);
    }
    return () => {
      if (poll) clearInterval(poll);
      detach?.();
    };
  }, [maxPlaybackRate]);

  React.useEffect(() => {
    const save = () => {
      const engine = mediaRef.current?.engine;
      if (engine) writeBandwidthEstimate(storage, engine.bandwidthEstimate);
    };
    const interval = setInterval(save, bandwidthSaveIntervalMs);
    window.addEventListener("pagehide", save);
    return () => {
      clearInterval(interval);
      window.removeEventListener("pagehide", save);
      save();
    };
  }, [storage]);

  React.useEffect(() => {
    if (appliedChoiceRef.current || renditions.length === 0) return;
    appliedChoiceRef.current = true;
    const choice = readQualityChoice(storage);
    if (choice === automaticChoice) return;
    const id = renditionForChoice(choice, renditions);
    if (id) store.selectVideoRendition(id);
  }, [renditions, storage, store]);

  const rememberQuality = React.useCallback(
    (value: string) => {
      if (value === "auto") {
        writeQualityChoice(storage, automaticChoice);
        return;
      }
      const choice = choiceForRendition(value, renditions);
      if (choice) writeQualityChoice(storage, choice);
    },
    [renditions, storage],
  );

  const retry = () => {
    coordinator.reset();
    setFailure(null);
    void recover();
  };

  return (
    <Container
      data-slot="video-player"
      aria-label={title}
      className={cn(
        "bg-player text-player-foreground relative aspect-video w-full overflow-hidden rounded-xl shadow-lg",
        className,
      )}
    >
      <HlsJsVideo
        ref={videoRef}
        mediaRef={mediaRef}
        source={source}
        playsInline
        autoPlay={autoPlay}
        preload="metadata"
        poster={poster}
        className="size-full object-contain"
        onError={() => {
          if (!mediaRef.current?.engine) void recover();
        }}
      >
        {captions.map((caption) => (
          <track
            key={caption.language}
            kind="captions"
            src={captionTrackUrl(manifestPath, caption.language)}
            srcLang={caption.language}
            label={captionLabel(caption.language)}
          />
        ))}
      </HlsJsVideo>
      {started || !paused ? null : (
        <PlayButton
          className="from-player/70 to-player/10 absolute inset-0 z-1 grid place-items-center bg-linear-to-t outline-none"
          render={(props) => (
            <button {...props} type="button" aria-label={`Play ${title}`}>
              <span className="bg-primary text-primary-foreground grid size-16 place-items-center rounded-full shadow-lg transition-transform hover:scale-105 md:size-20">
                <PlayIcon aria-hidden="true" className="size-7 translate-x-0.5 md:size-9" />
              </span>
            </button>
          )}
        />
      )}
      <PlayerControls onQualityChange={rememberQuality} />
      <Hotkey keys="Space" action="togglePaused" />
      <Hotkey keys="k" action="togglePaused" />
      <Hotkey keys="m" action="toggleMuted" />
      <Hotkey keys="f" action="toggleFullscreen" />
      <Hotkey keys="c" action="toggleSubtitles" />
      <Hotkey keys="ArrowLeft" action="seekStep" value={-10} />
      <Hotkey keys="ArrowRight" action="seekStep" value={10} />
      <Hotkey keys="j" action="seekStep" value={-10} />
      <Hotkey keys="l" action="seekStep" value={10} />
      <Hotkey keys="ArrowUp" action="volumeStep" value={0.05} />
      <Hotkey keys="ArrowDown" action="volumeStep" value={-0.05} />
      <Hotkey keys="0-9" action="seekToPercent" />
      <Hotkey keys="<" action="speedDown" />
      <Hotkey keys=">" action="speedUp" />
      <StatusAnnouncer />
      {failure ? (
        <div
          role="alert"
          className="bg-player/90 absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 p-4 text-center"
        >
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium">{failureText[failure].title}</p>
            <p className="text-player-foreground/80 text-sm">{failureText[failure].description}</p>
          </div>
          <Button variant="secondary" onClick={retry}>
            Retry
          </Button>
        </div>
      ) : null}
    </Container>
  );
}

function VideoPlayer({ maxPlaybackRate, ...props }: VideoPlayerProps) {
  const rates = React.useMemo(() => playbackRatesUpTo(maxPlaybackRate), [maxPlaybackRate]);
  return (
    <Player defaultPlaybackRates={rates}>
      <PlayerSurface maxPlaybackRate={maxPlaybackRate} {...props} />
    </Player>
  );
}

export { VideoPlayer };
export type { VideoPlayerProps };
