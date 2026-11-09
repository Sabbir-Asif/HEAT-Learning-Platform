import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { BottomBar } from "./bottom-bar";
import { fixtureItems } from "./fixtures";

const meta = {
  title: "Shell/BottomBar",
  component: BottomBar,
  tags: ["test"],
  parameters: { layout: "fullscreen", viewport: { defaultViewport: "mobile1" } },
  args: { items: fixtureItems, pathname: "/learn/course/module", label: "Learner mobile" },
  decorators: [
    (Story) => (
      <div className="flex min-h-48 flex-col justify-end">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof BottomBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  parameters: { viewport: { defaultViewport: "mobile1" } },
  globals: { viewport: { value: "mobile1", isRotated: false } },
  play: async ({ canvas }) => {
    await expect(canvas.getAllByRole("link")).toHaveLength(5);
    await expect(canvas.getByRole("link", { name: "My Learning" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  },
};

export const Light: Story = { ...Default, globals: { ...Default.globals, theme: "light" } };

export const Dark: Story = { ...Default, globals: { ...Default.globals, theme: "dark" } };
