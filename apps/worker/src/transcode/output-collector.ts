import { join } from "node:path";
import type { HlsFilesystem } from "./hls-filesystem";
import type { CodecProbe } from "./media-probe";
import { segmentFileNames } from "./output-validation";
import type { OutputSnapshot, RenditionOutput } from "./output-validation";

export const MASTER_FILE = "master.m3u8";
export const RENDITION_PLAYLIST = "index.m3u8";

const segmentName = /^segment_\d{5}\.ts$/;

const collectRendition = async (
  filesystem: HlsFilesystem,
  codecs: CodecProbe,
  directory: string,
  name: string,
): Promise<RenditionOutput> => {
  const playlistPath = join(directory, name, RENDITION_PLAYLIST);
  const playlist = await filesystem.readText(playlistPath);
  if (playlist === null) return { name, playlist, missingSegments: [], codecs: null };
  const present = await Promise.all(
    segmentFileNames(playlist)
      .filter((file) => segmentName.test(file))
      .map(async (file) => ({ file, found: await filesystem.exists(join(directory, name, file)) })),
  );
  return {
    name,
    playlist,
    missingSegments: present.filter((entry) => !entry.found).map((entry) => entry.file),
    codecs: await codecs.codecs(playlistPath),
  };
};

export const collectOutput = async (
  filesystem: HlsFilesystem,
  codecs: CodecProbe,
  directory: string,
  renditionNames: readonly string[],
): Promise<OutputSnapshot> => ({
  master: await filesystem.readText(join(directory, MASTER_FILE)),
  renditions: await Promise.all(
    renditionNames.map((name) => collectRendition(filesystem, codecs, directory, name)),
  ),
});
