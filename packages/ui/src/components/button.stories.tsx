import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { SearchIcon, PlusIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./tooltip";
import { Button } from "./button";

const meta = {
  title: "Primitives/Button",
  component: Button,
  tags: ["test"],
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

const content = () => (
  <div className="flex flex-wrap items-center gap-2 p-4">
    <Button>Save</Button>
    <Button variant="outline">Cancel</Button>
    <Button variant="secondary">Draft</Button>
    <Button variant="ghost">Skip</Button>
    <Button variant="destructive">Remove</Button>
    <Button variant="link">Learn more</Button>
    <Button disabled>Disabled</Button>
    <Button>
      <PlusIcon data-icon="inline-start" />
      Add course
    </Button>
  </div>
);

export const Default: Story = { render: content };

export const Light: Story = { render: content, globals: { theme: "light" } };

export const Dark: Story = { render: content, globals: { theme: "dark" } };

export const IconOnly: Story = {
  render: () => (
    <TooltipProvider>
      <div className="p-4">
        <Tooltip>
          <TooltipTrigger render={<Button size="icon" variant="outline" aria-label="Search" />}>
            <SearchIcon />
          </TooltipTrigger>
          <TooltipContent>Search</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: "Search" })).toBeVisible();
  },
};

export const ResponsiveLabel: Story = {
  render: () => (
    <TooltipProvider>
      <div className="p-4">
        <Tooltip>
          <TooltipTrigger render={<Button variant="outline" />}>
            <PlusIcon data-icon="inline-start" />
            <span className="max-md:sr-only">Add course</span>
          </TooltipTrigger>
          <TooltipContent>Add course</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: "Add course" })).toBeInTheDocument();
  },
};
