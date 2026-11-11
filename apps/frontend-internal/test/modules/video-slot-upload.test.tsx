import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const sendMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>();

vi.mock("@heat/api-client", () => ({
  fetchResponse: (url: string, init?: RequestInit) => sendMock(url, init),
}));

const { VideoSlotUpload } = await import("../../src/modules/video-slot-upload");

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const location = "/api/admin/courses/c/modules/m/videos/v/upload/key";
let root: Root | undefined;
let container: HTMLElement | undefined;

beforeEach(() => {
  sendMock.mockReset();
});

afterEach(async () => {
  await act(async () => root?.unmount());
  container?.remove();
});

async function mount(onFinished = vi.fn(), disabled = false) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(
      <VideoSlotUpload
        courseId="c"
        moduleId="m"
        videoId="v"
        title="Welcome"
        hasVideo={false}
        disabled={disabled}
        onFinished={onFinished}
      />,
    );
  });
  return { onFinished, container };
}

async function choose(file: File) {
  const input = container?.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error("input missing");
  Object.defineProperty(input, "files", { value: [file], configurable: true });
  await act(async () => {
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

const mp4 = () => new File([new Uint8Array(100)], "welcome.mp4", { type: "video/mp4" });

describe("VideoSlotUpload", () => {
  test("uploads the chosen file into the slot and tells the panel when it finishes", async () => {
    sendMock.mockResolvedValueOnce(
      new Response(null, { status: 201, headers: { Location: location } }),
    );
    sendMock.mockResolvedValueOnce(
      new Response(null, { status: 204, headers: { "Upload-Offset": "100" } }),
    );
    const { onFinished } = await mount();
    await choose(mp4());
    await vi.waitFor(() => expect(container?.textContent).toContain("welcome.mp4 uploaded"));
    expect(sendMock.mock.calls[0]?.[0]).toBe("/admin/courses/c/modules/m/videos/v/upload");
    expect(onFinished).toHaveBeenCalledOnce();
  });

  test("shows the reason when the server refuses the file", async () => {
    sendMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ error: { code: "CONTENT_LOCKED", message: "x", requestId: "r" } }),
        {
          status: 409,
        },
      ),
    );
    await mount();
    await choose(mp4());
    await vi.waitFor(() =>
      expect(container?.querySelector('[role="alert"]')?.textContent).toContain(
        "This course is locked, so videos cannot be uploaded.",
      ),
    );
    expect(container?.textContent).toContain("Retry");
  });

  test("a locked course disables the chooser", async () => {
    await mount(vi.fn(), true);
    const button = Array.from(container?.querySelectorAll("button") ?? []).find((item) =>
      item.textContent?.includes("Upload video"),
    );
    expect(button?.disabled).toBe(true);
  });
});
