import { describe, expect, test } from "vitest";
import {
  bufferConfig,
  captionLabel,
  captionTrackUrl,
  choiceForRendition,
  isForbiddenError,
  playbackRatesUpTo,
  renditionForChoice,
} from "../../src/player/engine-config";

const ladder = [
  { id: "a", height: 360 },
  { id: "b", height: 480 },
  { id: "c", height: 720 },
  { id: "d", height: 1080 },
];

describe("buffer", () => {
  test("holds about 20 seconds ahead and 30 behind", () => {
    expect(bufferConfig.maxBufferLength).toBe(20);
    expect(bufferConfig.maxMaxBufferLength).toBe(20);
    expect(bufferConfig.backBufferLength).toBe(30);
  });
});

describe("playbackRatesUpTo", () => {
  test("stops at the top speed", () => {
    expect(playbackRatesUpTo(1.5)).toEqual([0.5, 0.75, 1, 1.25, 1.5]);
  });
});

describe("remembered quality", () => {
  test("selects the rendition with the remembered height", () => {
    expect(renditionForChoice("480p", ladder)).toBe("b");
    expect(renditionForChoice("1080p", ladder)).toBe("d");
  });

  test("falls back to the nearest lower rendition", () => {
    expect(renditionForChoice("540p", ladder)).toBe("b");
  });

  test("leaves selection automatic when nothing fits", () => {
    expect(renditionForChoice("240p", ladder)).toBeNull();
    expect(renditionForChoice("auto", ladder)).toBeNull();
    expect(renditionForChoice("480p", [{ id: "x" }])).toBeNull();
  });

  test("names the choice from a picked rendition", () => {
    expect(choiceForRendition("b", ladder)).toBe("480p");
    expect(choiceForRendition("auto", ladder)).toBeNull();
    expect(choiceForRendition("x", [{ id: "x" }])).toBeNull();
  });
});

describe("captions", () => {
  test("builds the track url next to the manifest", () => {
    expect(captionTrackUrl("/hls/abc/master.m3u8", "en")).toBe("/hls/abc/captions/en.vtt");
    expect(captionTrackUrl("/hls/abc/master.m3u8", "pt-BR")).toBe("/hls/abc/captions/pt-BR.vtt");
  });

  test("labels a language in English", () => {
    expect(captionLabel("en")).toBe("English");
    expect(captionLabel("zz-invalid-tag-!")).toBe("zz-invalid-tag-!");
  });
});

describe("isForbiddenError", () => {
  test("detects a 403 response only", () => {
    expect(isForbiddenError({ response: { code: 403 } })).toBe(true);
    expect(isForbiddenError({ response: { code: 404 } })).toBe(false);
    expect(isForbiddenError({})).toBe(false);
  });
});
