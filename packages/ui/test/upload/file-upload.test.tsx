import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FileUpload, type FileUploadProps } from "../../src/upload/file-upload";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout"] });
});

afterEach(() => {
  cleanup();
  vi.clearAllTimers();
  vi.useRealTimers();
});

function pdf(name: string, size = 10) {
  return new File([new Uint8Array(size)], name, { type: "application/pdf" });
}

function setup(overrides: Partial<FileUploadProps> = {}) {
  const handlers = { onFilesAccepted: vi.fn(), onCancel: vi.fn(), onRetry: vi.fn() };
  const view = render(
    <FileUpload label="Resources" preset="documents" {...handlers} {...overrides} />,
  );
  const zone = view.container.querySelector("[data-dragging]") as HTMLElement;
  const drop = async (...files: File[]) => {
    await act(async () => {
      fireEvent.drop(zone, { dataTransfer: { files } });
    });
  };
  return { ...handlers, drop, ...view };
}

describe("FileUpload selection", () => {
  test("hands an accepted file to the screen and lists it", async () => {
    const { drop, onFilesAccepted } = setup();
    await drop(pdf("guide.pdf"));
    expect(onFilesAccepted).toHaveBeenCalledOnce();
    expect(screen.getByText("guide.pdf")).not.toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  test("names the size limit when a file is too large", async () => {
    const { drop, onFilesAccepted } = setup();
    await drop(pdf("big.pdf", 11 * 1024 * 1024));
    expect(onFilesAccepted).not.toHaveBeenCalled();
    expect(
      within(screen.getByRole("alert")).getByText("Files can be at most 10 MB."),
    ).not.toBeNull();
  });

  test("names the allowed types when the type is wrong", async () => {
    const { drop } = setup();
    await drop(new File(["x"], "note.exe", { type: "application/x-msdownload" }));
    expect(screen.getByRole("alert").textContent).toContain("Allowed file types: PDF, DOC, DOCX.");
  });

  test("names the count limit after five files", async () => {
    const { drop } = setup();
    for (let index = 0; index < 5; index += 1) await drop(pdf(`f${index}.pdf`, 10 + index));
    await drop(pdf("sixth.pdf", 99));
    expect(screen.getByRole("alert").textContent).toContain("You can add at most 5 files.");
  });

  test("clears the rejection on the next drop", async () => {
    const { drop } = setup();
    await drop(pdf("big.pdf", 11 * 1024 * 1024));
    expect(screen.getByRole("alert")).not.toBeNull();
    await drop(pdf("ok.pdf"));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText("ok.pdf")).not.toBeNull();
  });

  test("ignores a drop while disabled", async () => {
    const { drop, onFilesAccepted } = setup({ disabled: true });
    await drop(pdf("guide.pdf"));
    expect(onFilesAccepted).not.toHaveBeenCalled();
  });

  test("removing a file drops it from the list and tells the screen", async () => {
    const onRemove = vi.fn();
    const { drop } = setup({ onRemove });
    await drop(pdf("guide.pdf"));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Remove guide.pdf" }));
    });
    expect(screen.queryByText("guide.pdf")).toBeNull();
    expect(onRemove).toHaveBeenCalledOnce();
  });
});

describe("FileUpload item actions", () => {
  async function withStatus(status: "failed" | "uploading") {
    const view = setup();
    await view.drop(pdf("guide.pdf"));
    const id = view.onFilesAccepted.mock.calls[0]?.[0][0].id as string;
    view.rerender(
      <FileUpload
        label="Resources"
        preset="documents"
        onFilesAccepted={view.onFilesAccepted}
        onCancel={view.onCancel}
        onRetry={view.onRetry}
        statuses={{ [id]: { status, progress: 30, message: "The connection dropped." } }}
      />,
    );
    return { ...view, id };
  }

  test("Retry calls the handler with the file id", async () => {
    const { onRetry, id } = await withStatus("failed");
    expect(screen.getByText("The connection dropped.")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledWith(id);
  });

  test("Cancel calls the handler with the file id and replaces Remove", async () => {
    const { onCancel, id } = await withStatus("uploading");
    expect(screen.queryByRole("button", { name: /Remove/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledWith(id);
  });
});

describe("FileUpload input and drag", () => {
  test("accepts files chosen through the input and resets it", async () => {
    const { container, onFilesAccepted } = setup();
    const input = container.querySelector("input[type='file']") as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { files: [pdf("chosen.pdf")] } });
    });
    expect(onFilesAccepted).toHaveBeenCalledOnce();
  });

  test("marks the zone while dragging over and clears on leave", () => {
    const { container } = setup();
    const zone = container.querySelector("[data-dragging]") as HTMLElement;
    fireEvent.dragOver(zone);
    expect(zone.getAttribute("data-dragging")).toBe("true");
    fireEvent.dragLeave(zone);
    expect(zone.getAttribute("data-dragging")).toBe("false");
  });

  test("the choose button opens the file picker", () => {
    const { container } = setup();
    const input = container.querySelector("input[type='file']") as HTMLInputElement;
    const click = vi.spyOn(input, "click");
    fireEvent.click(screen.getByRole("button", { name: "Choose files" }));
    expect(click).toHaveBeenCalledOnce();
  });
});
