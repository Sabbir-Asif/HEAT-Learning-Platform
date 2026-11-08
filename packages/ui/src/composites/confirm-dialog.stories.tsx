import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";
import { Button } from "../components/button";
import { ConfirmDialog } from "./confirm-dialog";

const meta = {
  title: "Composites/ConfirmDialog",
  component: ConfirmDialog,
  tags: ["test"],
  args: {
    title: "Delete course",
    itemName: "Gender safety basics",
    description: "This removes the course and cannot be undone.",
    confirmLabel: "Delete course",
    destructive: true,
    trigger: <Button variant="outline">Delete</Button>,
    onConfirm: fn(),
  },
  render: (args) => (
    <div className="p-4">
      <ConfirmDialog {...args} />
    </div>
  ),
} satisfies Meta<typeof ConfirmDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { confirmationName: "Gender safety basics" },
};

export const Light: Story = { ...Default, globals: { theme: "light" } };

export const Dark: Story = { ...Default, globals: { theme: "dark" } };

export const Reversible: Story = {
  args: {
    title: "Approve student",
    itemName: "Rahim Uddin",
    description: "The student gets access to the course.",
    confirmLabel: "Approve",
    destructive: false,
    confirmationName: undefined,
  },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Delete" }));
    const dialog = await screen.findByRole("dialog");
    await expect(within(dialog).getByRole("button", { name: "Approve" })).toBeEnabled();
  },
};

export const TypedName: Story = {
  args: { confirmationName: "Gender safety basics" },
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole("button", { name: "Delete" });
    await userEvent.click(trigger);
    const dialog = await screen.findByRole("dialog");
    const confirm = within(dialog).getByRole("button", { name: "Delete course" });
    await waitFor(() => expect(dialog).toContainElement(document.activeElement as HTMLElement));
    await expect(confirm).toBeDisabled();
    const field = within(dialog).getByLabelText("Type the name above to confirm");
    await userEvent.type(field, "Gender safety basics");
    await expect(confirm).toBeEnabled();
    await userEvent.type(field, "x");
    await expect(confirm).toBeDisabled();
  },
};

export const Keyboard: Story = {
  args: { confirmationName: "Gender safety basics" },
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole("button", { name: "Delete" });
    await userEvent.click(trigger);
    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(dialog).toContainElement(document.activeElement as HTMLElement));
    for (let index = 0; index < 8; index += 1) {
      await userEvent.tab();
      await waitFor(() => expect(dialog).toContainElement(document.activeElement as HTMLElement));
    }
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(trigger).toHaveFocus());
  },
};

export const Pending: Story = {
  args: {
    confirmationName: undefined,
    onConfirm: fn(() => new Promise<void>(() => undefined)),
  },
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Delete" }));
    const dialog = await screen.findByRole("dialog");
    const confirm = within(dialog).getByRole("button", { name: "Delete course" });
    await userEvent.click(confirm);
    const busy = await within(dialog).findByRole("button", { name: "Working" });
    await expect(busy).toBeDisabled();
    await expect(args.onConfirm).toHaveBeenCalledTimes(1);
  },
};

export const Failure: Story = {
  args: {
    confirmationName: undefined,
    onConfirm: fn(() => Promise.reject(new Error("server detail"))),
  },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Delete" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Delete course" }));
    const alert = await within(dialog).findByRole("alert");
    await expect(alert).toHaveTextContent("This could not be completed. Try again.");
    await expect(alert).not.toHaveTextContent("server detail");
    await expect(screen.getByRole("dialog")).toHaveAttribute("data-open");
  },
};
