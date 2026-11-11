export const SEGMENT_SECONDS = 6;

const AUDIO_KBPS = 96;
const LOWEST_VIDEO_KBPS = 400;
const MAXRATE_FACTOR = 1.07;
const BUFSIZE_FACTOR = 2;
const VIDEO_CODEC = "avc1.640028";
const AUDIO_CODEC = "mp4a.40.2";

export interface Rendition {
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly videoKbps: number;
  readonly audioKbps: number;
}

const rung = (height: number, width: number, videoKbps: number): Rendition => ({
  name: `${height}p`,
  width,
  height,
  videoKbps,
  audioKbps: AUDIO_KBPS,
});

export const LADDER: readonly Rendition[] = [
  rung(360, 640, LOWEST_VIDEO_KBPS),
  rung(480, 854, 650),
  rung(720, 1280, 1100),
  rung(1080, 1920, 2200),
];

const evenWidthFor = (height: number): number => Math.round((height * 16) / 9 / 2) * 2;

export function selectRenditions(sourceHeight: number): Rendition[] {
  if (!Number.isInteger(sourceHeight) || sourceHeight <= 0) {
    throw new Error("Source height must be a positive integer");
  }
  const fitting = LADDER.filter((r) => r.height <= sourceHeight);
  if (fitting.length > 0) return fitting;
  const height = Math.max(2, sourceHeight - (sourceHeight % 2));
  return [{ ...rung(height, evenWidthFor(height), LOWEST_VIDEO_KBPS) }];
}

export interface SourceSize {
  readonly width: number;
  readonly height: number;
}

export function renditionsForSource(source: SourceSize): Rendition[] {
  if (!(source.width > 0) || !(source.height > 0)) {
    throw new Error("Source size must be positive");
  }
  return selectRenditions(source.height).map((r) => ({
    ...r,
    width: Math.max(2, Math.round((r.height * source.width) / source.height / 2) * 2),
  }));
}

export function gopFrames(fps: number): number {
  return Math.round(fps * SEGMENT_SECONDS);
}

export interface EncodeOptions {
  readonly input: string;
  readonly outputDir: string;
  readonly fps: number;
}

export function buildRenditionArgs(rendition: Rendition, options: EncodeOptions): string[] {
  if (!(options.fps > 0)) throw new Error("Frame rate must be positive");
  if (options.outputDir.includes("%")) throw new Error("Output directory must not contain %");
  const gop = String(gopFrames(options.fps));
  const folder = `${options.outputDir}/${rendition.name}`;
  return [
    "-protocol_whitelist",
    "file",
    "-nostdin",
    "-y",
    "-i",
    options.input,
    "-map",
    "0:v:0",
    "-map",
    "0:a:0?",
    "-vf",
    `scale=-2:${rendition.height}`,
    "-r",
    String(options.fps),
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-profile:v",
    "high",
    "-level",
    "4.0",
    "-pix_fmt",
    "yuv420p",
    "-b:v",
    `${rendition.videoKbps}k`,
    "-maxrate",
    `${Math.round(rendition.videoKbps * MAXRATE_FACTOR)}k`,
    "-bufsize",
    `${rendition.videoKbps * BUFSIZE_FACTOR}k`,
    "-g",
    gop,
    "-keyint_min",
    gop,
    "-sc_threshold",
    "0",
    "-force_key_frames",
    `expr:gte(t,n_forced*${SEGMENT_SECONDS})`,
    "-c:a",
    "aac",
    "-b:a",
    `${rendition.audioKbps}k`,
    "-ac",
    "2",
    "-ar",
    "48000",
    "-f",
    "hls",
    "-hls_time",
    String(SEGMENT_SECONDS),
    "-hls_playlist_type",
    "vod",
    "-hls_flags",
    "independent_segments",
    "-hls_segment_type",
    "mpegts",
    "-hls_segment_filename",
    `${folder}/segment_%05d.ts`,
    `${folder}/index.m3u8`,
  ];
}

export interface MasterOptions {
  readonly audio?: boolean;
}

export function buildMasterPlaylist(
  renditions: readonly Rendition[],
  options: MasterOptions = {},
): string {
  if (renditions.length === 0) throw new Error("A master playlist needs at least one rendition");
  const audio = options.audio ?? true;
  const codecs = audio ? `${VIDEO_CODEC},${AUDIO_CODEC}` : VIDEO_CODEC;
  const entries = renditions.flatMap((r) => [
    `#EXT-X-STREAM-INF:BANDWIDTH=${(r.videoKbps + (audio ? r.audioKbps : 0)) * 1000},RESOLUTION=${r.width}x${r.height},CODECS="${codecs}"`,
    `${r.name}/index.m3u8`,
  ]);
  return ["#EXTM3U", "#EXT-X-VERSION:3", "#EXT-X-INDEPENDENT-SEGMENTS", ...entries, ""].join("\n");
}
