import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { Progress, ProgressLabel, ProgressValue } from "./progress";

const meta = {
  title: "Primitives/Progress",
  component: Progress,
  tags: ["test"],
  args: { value: 40 },
} satisfies Meta<typeof Progress>;

export default meta;
type Story = StoryObj<typeof meta>;

const content = () => (
  <div className="p-4">
    <Progress value={40}>
      <ProgressLabel>Course progress</ProgressLabel>
      <ProgressValue />
    </Progress>
  </div>
);

export const Default: Story = { render: content };

export const Light: Story = { render: content, globals: { theme: "light" } };

export const Dark: Story = { render: content, globals: { theme: "dark" } };

export const Empty: Story = {
  render: () => (
    <div className="p-4">
      <Progress value={0}>
        <ProgressLabel>Course progress</ProgressLabel>
        <ProgressValue />
      </Progress>
    </div>
  ),
};

export const Complete: Story = {
  render: () => (
    <div className="p-4">
      <Progress value={100}>
        <ProgressLabel>Course progress</ProgressLabel>
        <ProgressValue />
      </Progress>
    </div>
  ),
  play: async ({ canvas }) => {
    const bar = canvas.getByRole("progressbar");
    await expect(bar).toHaveAttribute("aria-valuenow", "100");
    await expect(bar).toHaveAttribute("aria-valuemin", "0");
    await expect(bar).toHaveAttribute("aria-valuemax", "100");
  },
};
