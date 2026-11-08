import type { Meta, StoryObj } from "@storybook/react-vite";
import { toast } from "sonner";
import { expect, screen, userEvent } from "storybook/test";
import { Button } from "./button";
import { Toaster } from "./sonner";

const meta = {
  title: "Primitives/Toaster",
  component: Toaster,
  tags: ["test"],
} satisfies Meta<typeof Toaster>;

export default meta;
type Story = StoryObj<typeof meta>;

const content = () => (
  <div className="p-4">
    <Toaster />
    <Button
      variant="outline"
      onClick={() => toast.success("Student approved", { description: "They can now sign in." })}
    >
      Approve
    </Button>
  </div>
);

export const Default: Story = { render: content };

export const Light: Story = { render: content, globals: { theme: "light" } };

export const Dark: Story = { render: content, globals: { theme: "dark" } };

export const Announced: Story = {
  render: content,
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Approve" }));
    await expect(await screen.findByText("Student approved")).toBeInTheDocument();
    await expect(screen.getByText("They can now sign in.")).toBeInTheDocument();
    await expect(document.querySelector("[aria-live]")).not.toBeNull();
  },
};
