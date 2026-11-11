import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, test } from "vitest";
import VideoSlot from "../../src/learn/video-slot";
import { VideoAreaLoading } from "../../src/learn/video-area";
import { makeModule } from "./fixtures";
import { mount } from "./mount";

const withClient = (element: React.ReactElement) => (
  <QueryClientProvider client={new QueryClient()}>{element}</QueryClientProvider>
);

describe("VideoSlot", () => {
  test("shows each video with its title, required flag and watch status", async () => {
    const [video] = makeModule(1).videos;
    const view = await mount(
      withClient(
        <VideoSlot videos={[{ ...video!, status: "IN_PROGRESS", coveragePercent: 40 }]} />,
      ),
    );

    expect(view.textContent).toContain("Video 1");
    expect(view.textContent).toContain("Required");
    expect(view.textContent).toContain("40% watched");
  });

  test("says when a video is not available yet", async () => {
    const [video] = makeModule(1).videos;
    const view = await mount(
      withClient(<VideoSlot videos={[{ ...video!, status: "UNAVAILABLE" }]} />),
    );

    expect(view.textContent).toContain("This video is not available yet.");
  });
});

describe("VideoSlot playback start", () => {
  test("offers a play button and no player until the student asks for one", async () => {
    const [video] = makeModule(1).videos;
    const view = await mount(withClient(<VideoSlot videos={[video!]} />));

    expect(view.textContent).toContain("Play video");
    expect(view.querySelector('[data-slot="video-player"]')).toBeNull();
  });

  test("does not offer playback for an unavailable video", async () => {
    const [video] = makeModule(1).videos;
    const view = await mount(
      withClient(<VideoSlot videos={[{ ...video!, status: "UNAVAILABLE" }]} />),
    );

    expect(view.textContent).not.toContain("Play video");
  });
});

describe("VideoAreaLoading", () => {
  test("reserves a 16:9 region with a skeleton and announces itself", async () => {
    const view = await mount(<VideoAreaLoading />);

    expect(view.querySelector('[data-slot="skeleton"]')?.className).toContain("aspect-video");
    expect(view.querySelector('[role="status"]')?.textContent).toBe("Loading video");
  });
});
