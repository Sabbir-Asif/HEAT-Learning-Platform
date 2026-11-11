export const bufferAheadSeconds = 20;
export const bufferBehindSeconds = 30;
export const playbackRateSteps = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;

export const bufferConfig = {
  maxBufferLength: bufferAheadSeconds,
  maxMaxBufferLength: bufferAheadSeconds,
  backBufferLength: bufferBehindSeconds,
} as const;

export const playbackRatesUpTo = (maxRate: number): number[] =>
  playbackRateSteps.filter((rate) => rate <= maxRate);

export interface RenditionLike {
  id: string;
  height?: number | undefined;
}

export const renditionForChoice = (
  choice: string,
  renditions: readonly RenditionLike[],
): string | null => {
  const wanted = Number.parseInt(choice, 10);
  if (!Number.isFinite(wanted)) return null;
  const sized = renditions.filter(
    (rendition): rendition is RenditionLike & { height: number } =>
      typeof rendition.height === "number",
  );
  const exact = sized.find((rendition) => rendition.height === wanted);
  if (exact) return exact.id;
  const below = sized.filter((rendition) => rendition.height < wanted);
  if (below.length === 0) return null;
  return below.reduce((best, rendition) => (rendition.height > best.height ? rendition : best)).id;
};

export const choiceForRendition = (
  id: string,
  renditions: readonly RenditionLike[],
): string | null => {
  const height = renditions.find((rendition) => rendition.id === id)?.height;
  return typeof height === "number" ? `${height}p` : null;
};

export const captionTrackUrl = (manifestPath: string, language: string): string => {
  const directory = manifestPath.slice(0, manifestPath.lastIndexOf("/") + 1);
  return `${directory}captions/${encodeURIComponent(language)}.vtt`;
};

export const captionLabel = (language: string): string => {
  try {
    return new Intl.DisplayNames(["en"], { type: "language" }).of(language) ?? language;
  } catch {
    return language;
  }
};

export interface HlsErrorLike {
  response?: { code?: number } | undefined;
}

export const isForbiddenError = (data: HlsErrorLike): boolean => data.response?.code === 403;
