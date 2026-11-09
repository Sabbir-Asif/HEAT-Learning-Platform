import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent } from "storybook/test";
import { ShellContent, ShellHeader, ShellMain, SkipLink } from "./skip-link";

const meta = {
  title: "Shell/SkipLink",
  component: SkipLink,
  tags: ["test"],
  parameters: { layout: "fullscreen" },
  render: (args) => (
    <>
      <SkipLink {...args} />
      <ShellHeader>
        <span className="font-display text-heading-3">HEAT</span>
      </ShellHeader>
      <ShellMain>
        <ShellContent>
          <h1 className="font-display text-heading-1">Page title</h1>
        </ShellContent>
      </ShellMain>
    </>
  ),
} satisfies Meta<typeof SkipLink>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    await userEvent.tab();
    const link = canvas.getByRole("link", { name: "Skip to main content" });
    await expect(link).toHaveFocus();
    await expect(link).toHaveAttribute("href", "#main-content");
    await expect(canvas.getByRole("main")).toHaveAttribute("id", "main-content");
  },
};

export const Light: Story = { ...Default, globals: { theme: "light" } };

export const Dark: Story = { ...Default, globals: { theme: "dark" } };
