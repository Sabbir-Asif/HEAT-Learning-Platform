import type { Meta, StoryObj } from "@storybook/react-vite";
import { Input } from "./input";
import { Label } from "./label";

const meta = {
  title: "Primitives/Label",
  component: Label,
  tags: ["test"],
} satisfies Meta<typeof Label>;

export default meta;
type Story = StoryObj<typeof meta>;

const content = () => (
  <div className="flex max-w-sm flex-col gap-2 p-4">
    <Label htmlFor="email">Email</Label>
    <Input id="email" type="email" />
  </div>
);

export const Default: Story = { render: content };

export const Light: Story = { render: content, globals: { theme: "light" } };

export const Dark: Story = { render: content, globals: { theme: "dark" } };
