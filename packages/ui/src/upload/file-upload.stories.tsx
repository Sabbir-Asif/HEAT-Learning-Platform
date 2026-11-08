import type { Meta, StoryObj } from "@storybook/react-vite";
import * as React from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { FileUpload, type AcceptedFile, type UploadItemState } from "./file-upload";

type Scenario = "idle" | "uploading" | "failed";

type DemoProps = { preset?: "images" | "documents"; scenario?: Scenario };

const onAccepted = fn();
const onCancel = fn();
const onRetry = fn();

function Demo({ preset = "images", scenario = "idle" }: DemoProps) {
  const [statuses, setStatuses] = React.useState<Record<string, UploadItemState>>({});

  function accepted(files: AcceptedFile[]) {
    onAccepted(files.map((item) => item.file.name));
    setStatuses((previous) => ({
      ...previous,
      ...Object.fromEntries(
        files.map((item) => [
          item.id,
          scenario === "uploading"
            ? { status: "uploading", progress: 40 }
            : scenario === "failed"
              ? { status: "failed", message: "The connection dropped. Try again." }
              : { status: "queued" },
        ]),
      ),
    }));
  }

  return (
    <div className="max-w-md p-4">
      <FileUpload
        label="Profile photo"
        preset={preset}
        statuses={statuses}
        onFilesAccepted={accepted}
        onCancel={onCancel}
        onRetry={onRetry}
      />
    </div>
  );
}

const png = (name = "photo.png", bytes = 2048) =>
  new File([new Uint8Array(bytes)], name, { type: "image/png" });

function input(canvasElement: HTMLElement): HTMLInputElement {
  const found = canvasElement.querySelector<HTMLInputElement>('input[type="file"]');
  if (!found) throw new Error("file input not found");
  return found;
}

const meta = {
  title: "Upload/FileUpload",
  component: Demo,
  tags: ["test"],
} satisfies Meta<typeof Demo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", { name: "Choose files" })).toBeInTheDocument();
    await expect(canvas.getByText(/The server checks every file again/)).toBeInTheDocument();
    await expect(canvas.queryByRole("list", { name: "Selected files" })).toBeNull();
  },
};

export const Light: Story = { ...Default, globals: { theme: "light" } };

export const Dark: Story = { ...Default, globals: { theme: "dark" } };

export const AcceptsAValidFile: Story = {
  play: async ({ canvasElement }) => {
    onAccepted.mockClear();
    const canvas = within(canvasElement);
    await userEvent.upload(input(canvasElement), png());
    const list = await canvas.findByRole("list", { name: "Selected files" });
    await expect(within(list).getByText("photo.png")).toBeInTheDocument();
    await expect(within(list).getByText("2 KB")).toBeInTheDocument();
    await expect(onAccepted).toHaveBeenCalledWith(["photo.png"]);
    await expect(canvas.queryByRole("alert")).toBeNull();
  },
};

export const RejectsAFileOverTheLimit: Story = {
  play: async ({ canvasElement }) => {
    onAccepted.mockClear();
    const canvas = within(canvasElement);
    await userEvent.upload(input(canvasElement), png("big.png", 5 * 1024 * 1024 + 1));
    await expect(await canvas.findByRole("alert")).toHaveTextContent("at most 5 MB");
    await expect(canvas.queryByRole("list", { name: "Selected files" })).toBeNull();
    await expect(onAccepted).not.toHaveBeenCalled();
  },
};

export const RejectsAWrongType: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const file = new File(["x"], "script.svg", { type: "image/svg+xml" });
    await userEvent.upload(input(canvasElement), file, { applyAccept: false });
    await expect(await canvas.findByRole("alert")).toHaveTextContent("Allowed file types");
    await expect(canvas.queryByRole("list", { name: "Selected files" })).toBeNull();
  },
};

export const RejectsADuplicateAndTheSixthFile: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.upload(input(canvasElement), png("a.png"));
    await userEvent.upload(input(canvasElement), png("a.png"));
    await expect(await canvas.findByRole("alert")).toHaveTextContent("already in the list");

    for (const name of ["b.png", "c.png", "d.png", "e.png"]) {
      await userEvent.upload(input(canvasElement), png(name));
    }
    await userEvent.upload(input(canvasElement), png("f.png"));
    await waitFor(() => expect(canvas.getByRole("alert")).toHaveTextContent("at most 5 files"));
    await expect(
      within(canvas.getByRole("list", { name: "Selected files" })).getAllByRole("listitem"),
    ).toHaveLength(5);
  },
};

export const RemoveFreesASlot: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.upload(input(canvasElement), png("a.png"));
    await userEvent.click(await canvas.findByRole("button", { name: "Remove a.png" }));
    await waitFor(() => expect(canvas.queryByRole("list", { name: "Selected files" })).toBeNull());
  },
};

export const DropAddsFiles: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const zone = canvasElement.querySelector("[data-dragging]") as HTMLElement;
    const transfer = new DataTransfer();
    transfer.items.add(png("dropped.png"));
    zone.dispatchEvent(
      new DragEvent("drop", { dataTransfer: transfer, bubbles: true, cancelable: true }),
    );
    await expect(await canvas.findByText("dropped.png")).toBeInTheDocument();
  },
};

export const Uploading: Story = {
  args: { scenario: "uploading" },
  play: async ({ canvasElement }) => {
    onCancel.mockClear();
    const canvas = within(canvasElement);
    await userEvent.upload(input(canvasElement), png());
    await expect(
      await canvas.findByRole("progressbar", { name: "Uploading photo.png" }),
    ).toHaveAttribute("aria-valuenow", "40");
    await expect(canvas.getByRole("status")).toHaveTextContent("1 file, 1 uploading, 0 failed");
    await userEvent.click(canvas.getByRole("button", { name: "Cancel" }));
    await expect(onCancel).toHaveBeenCalledTimes(1);
  },
};

export const FailedWithRetry: Story = {
  args: { scenario: "failed" },
  play: async ({ canvasElement }) => {
    onRetry.mockClear();
    const canvas = within(canvasElement);
    await userEvent.upload(input(canvasElement), png());
    await expect(await canvas.findByRole("alert")).toHaveTextContent("The connection dropped");
    await userEvent.click(canvas.getByRole("button", { name: "Retry" }));
    await expect(onRetry).toHaveBeenCalledTimes(1);
    await expect(canvas.getByRole("button", { name: "Remove photo.png" })).toBeInTheDocument();
  },
};

export const KeyboardOnly: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.tab();
    await expect(canvas.getByRole("button", { name: "Choose files" })).toHaveFocus();
    await userEvent.upload(input(canvasElement), png("kbd.png"));
    const remove = await canvas.findByRole("button", { name: "Remove kbd.png" });
    remove.focus();
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(canvas.queryByText("kbd.png")).toBeNull());
  },
};

export const Documents: Story = {
  args: { preset: "documents" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/PDF, DOC, DOCX, up to 10 MB each/)).toBeInTheDocument();
    await userEvent.upload(
      input(canvasElement),
      new File(["x"], "form.pdf", { type: "application/pdf" }),
    );
    await expect(await canvas.findByText("form.pdf")).toBeInTheDocument();
  },
};

export const Phone: Story = {
  globals: { viewport: { value: "mobile1", isRotated: false } },
  play: async ({ canvasElement }) => {
    await userEvent.upload(
      input(canvasElement),
      png("a-very-long-file-name-for-a-small-screen-photo.png"),
    );
    await within(canvasElement).findByRole("list", { name: "Selected files" });
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
  },
};
