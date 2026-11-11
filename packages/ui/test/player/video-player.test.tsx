import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { VideoPlayer } from "../../src/player";

afterEach(cleanup);

const renderPlayer = (captions: { language: string }[]) =>
  render(
    <VideoPlayer
      title="Welcome"
      manifestPath="/hls/abc/master.m3u8"
      initialExpiresAt="2026-11-12T10:10:00Z"
      refreshSession={() => Promise.resolve({ expiresAt: "2026-11-12T10:20:00Z" })}
      maxPlaybackRate={1.5}
      captions={captions}
    />,
  );

describe("VideoPlayer", () => {
  test("labels the player region and renders caption tracks only when listed", () => {
    const { container, unmount } = renderPlayer([]);
    expect(screen.getByLabelText("Welcome")).toBeTruthy();
    expect(container.querySelectorAll("track")).toHaveLength(0);
    unmount();
    const withCaptions = renderPlayer([{ language: "en" }]);
    const track = withCaptions.container.querySelector("track");
    expect(track?.getAttribute("srclang")).toBe("en");
    expect(track?.getAttribute("label")).toBe("English");
    expect(track?.getAttribute("src")).toBe("/hls/abc/captions/en.vtt");
  });
});
