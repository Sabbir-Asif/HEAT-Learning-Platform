import type { Meta, StoryObj } from "@storybook/react-vite";
import { InfoIcon } from "lucide-react";
import { expect, screen, userEvent } from "storybook/test";
import { Button } from "./button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./tooltip";

const meta = {
  title: "Primitives/Tooltip",
  component: Tooltip,
  tags: ["test"],
} satisfies Meta<typeof Tooltip>;

export default meta;
type Story = StoryObj<typeof meta>;

const content = () => (
  <TooltipProvider>
    <div className="p-8">
      <Tooltip>
        <TooltipTrigger render={<Button variant="outline" size="icon" aria-label="Course info" />}>
          <InfoIcon />
        </TooltipTrigger>
        <TooltipContent>Shown on hover and on keyboard focus</TooltipContent>
      </Tooltip>
    </div>
  </TooltipProvider>
);

export const Default: Story = { render: content };

export const Light: Story = { render: content, globals: { theme: "light" } };

export const Dark: Story = { render: content, globals: { theme: "dark" } };

export const Keyboard: Story = {
  render: content,
  play: async ({ canvas }) => {
    await userEvent.tab();
    await expect(canvas.getByRole("button", { name: "Course info" })).toHaveFocus();
    await expect(
      await screen.findByText("Shown on hover and on keyboard focus"),
    ).toBeInTheDocument();
  },
};
