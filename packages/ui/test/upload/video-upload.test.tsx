import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { VideoUpload, type VideoUploadProps } from "../../src/upload/video-upload";

afterEach(cleanup);

const maxBytes = 2 * 1024 * 1024 * 1024;

function setup(overrides: Partial<VideoUploadProps> = {}) {
  const handlers = {
    onSelect: vi.fn(),
    onPause: vi.fn(),
    onResume: vi.fn(),
    onCancel: vi.fn(),
    onRetry: vi.fn(),
  };
  const view = render(
    <VideoUpload
      label="Welcome video"
      state={{ status: "idle" }}
      maxBytes={maxBytes}
      {...handlers}
      {...overrides}
    />,
  );
  const input = view.container.querySelector<HTMLInputElement>('input[type="file"]');
  if (input === null) throw new Error("file input missing");
  return { ...handlers, input, ...view };
}

const video = (name = "welcome.mp4", type = "video/mp4", size = 100) =>
  new File([new Uint8Array(size)], name, { type });

describe("VideoUpload", () => {
  test("idle state offers the choice and states the limits", () => {
    setup();
    expect(screen.getByRole("button", { name: "Upload video" })).not.toBeNull();
    expect(screen.getByText(/MP4, MOV, WebM or MKV, up to 2048 MB/)).not.toBeNull();
  });

  test("says Replace video when the slot already has one", () => {
    setup({ hasVideo: true });
    expect(screen.getByRole("button", { name: "Replace video" })).not.toBeNull();
  });

  test("hands a valid file to the screen", () => {
    const { input, onSelect } = setup();
    fireEvent.change(input, { target: { files: [video()] } });
    expect(onSelect).toHaveBeenCalledOnce();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  test("refuses a file of the wrong type in the browser and never hands it over", () => {
    const { input, onSelect } = setup();
    fireEvent.change(input, { target: { files: [video("notes.pdf", "application/pdf")] } });
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toContain("Allowed file types");
  });

  test("shows progress with a pause control while uploading", () => {
    const { onPause } = setup({
      state: { status: "uploading", fileName: "welcome.mp4", progress: 40 },
    });
    expect(screen.getByRole("progressbar")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    expect(onPause).toHaveBeenCalledOnce();
    expect(screen.queryByRole("button", { name: "Upload video" })).toBeNull();
  });

  test("a paused upload offers resume and cancel", () => {
    const { onResume, onCancel } = setup({
      state: { status: "paused", fileName: "welcome.mp4", progress: 40 },
    });
    fireEvent.click(screen.getByRole("button", { name: "Resume" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onResume).toHaveBeenCalledOnce();
    expect(onCancel).toHaveBeenCalledOnce();
  });

  test("a failed upload names the reason and offers retry", () => {
    const { onRetry } = setup({
      state: { status: "failed", fileName: "welcome.mp4", message: "The connection dropped." },
    });
    expect(screen.getByRole("alert").textContent).toContain("The connection dropped.");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  test("a finished upload says the server is checking it", () => {
    setup({ state: { status: "done", fileName: "welcome.mp4" } });
    expect(screen.getByRole("status").textContent).toContain("The server is checking it");
  });

  test("is disabled when the course is locked", () => {
    setup({ disabled: true });
    expect(
      (screen.getByRole("button", { name: "Upload video" }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });
});
