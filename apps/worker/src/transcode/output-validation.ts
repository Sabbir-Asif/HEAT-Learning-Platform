import { SEGMENT_SECONDS } from "./ladder";
import { parseMediaPlaylistDurations, segmentsAboutSixSeconds } from "./ladder-verify";

export interface RenditionOutput {
  name: string;
  playlist: string | null;
  missingSegments: string[];
  codecs: string[] | null;
}

export interface OutputSnapshot {
  master: string | null;
  renditions: RenditionOutput[];
}

export interface OutputExpectation {
  renditionNames: readonly string[];
  sourceDurationSeconds: number;
  hasAudio: boolean;
}

const MIN_DURATION_TOLERANCE_SECONDS = 2;
const DURATION_TOLERANCE_RATIO = 0.02;
const SEGMENT_COUNT_TOLERANCE = 1;
const segmentName = /^segment_\d{5}\.ts$/;

export const durationToleranceSeconds = (sourceSeconds: number): number =>
  Math.max(MIN_DURATION_TOLERANCE_SECONDS, sourceSeconds * DURATION_TOLERANCE_RATIO);

export const segmentFileNames = (playlist: string): string[] =>
  playlist
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("#"));

export const masterRenditionNames = (master: string): string[] =>
  segmentFileNames(master).map((line) => line.replace(/\/index\.m3u8$/, ""));

const sum = (values: readonly number[]): number =>
  values.reduce((total, value) => total + value, 0);

const sameList = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((value, index) => value === b[index]);

const expectedCodecs = (hasAudio: boolean): string[] => (hasAudio ? ["aac", "h264"] : ["h264"]);

const renditionProblems = (output: RenditionOutput, expectation: OutputExpectation): string[] => {
  const { name, playlist } = output;
  if (playlist === null) return [`${name}: playlist missing`];
  const problems: string[] = [];
  const names = segmentFileNames(playlist);
  const durations = parseMediaPlaylistDurations(playlist);
  if (names.length === 0 || names.length !== durations.length) {
    return [`${name}: playlist has no consistent segment list`];
  }
  if (!playlist.includes("#EXT-X-ENDLIST")) problems.push(`${name}: playlist is not complete`);
  if (!names.every((file) => segmentName.test(file))) {
    problems.push(`${name}: unexpected segment name`);
  }
  if (output.missingSegments.length > 0) {
    problems.push(`${name}: ${output.missingSegments.length} segments missing`);
  }
  const expectedCount = Math.ceil(expectation.sourceDurationSeconds / SEGMENT_SECONDS);
  if (Math.abs(names.length - expectedCount) > SEGMENT_COUNT_TOLERANCE) {
    problems.push(`${name}: ${names.length} segments, expected about ${expectedCount}`);
  }
  if (!segmentsAboutSixSeconds(durations))
    problems.push(`${name}: segments are not about 6 seconds`);
  const total = sum(durations);
  if (
    Math.abs(total - expectation.sourceDurationSeconds) >
    durationToleranceSeconds(expectation.sourceDurationSeconds)
  ) {
    problems.push(`${name}: duration ${total.toFixed(1)}s differs from the source`);
  }
  const codecs = output.codecs === null ? null : [...new Set(output.codecs)].sort();
  if (codecs === null || !sameList(codecs, expectedCodecs(expectation.hasAudio))) {
    problems.push(`${name}: codecs are ${codecs === null ? "unreadable" : codecs.join(",")}`);
  }
  return problems;
};

export const validateOutput = (
  expectation: OutputExpectation,
  snapshot: OutputSnapshot,
): string[] => {
  const problems: string[] = [];
  if (snapshot.master === null) {
    problems.push("master playlist missing");
  } else if (!sameList(masterRenditionNames(snapshot.master), expectation.renditionNames)) {
    problems.push("master playlist does not list the expected renditions");
  }
  for (const name of expectation.renditionNames) {
    const output = snapshot.renditions.find((candidate) => candidate.name === name);
    problems.push(
      ...(output === undefined
        ? [`${name}: output missing`]
        : renditionProblems(output, expectation)),
    );
  }
  return problems;
};
