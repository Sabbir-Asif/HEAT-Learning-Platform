import type { Meta, StoryObj } from "@storybook/react-vite";
import { Separator } from "./separator";

const meta = {
  title: "Primitives/Separator",
  component: Separator,
  tags: ["test"],
} satisfies Meta<typeof Separator>;

export default meta;
type Story = StoryObj<typeof meta>;

const content = () => (
  <div className="flex flex-col gap-3 p-4">
    <p>Above</p>
    <Separator />
    <p>Below</p>
  </div>
);

export const Default: Story = { render: content };

export const Light: Story = { render: content, globals: { theme: "light" } };

export const Dark: Story = { render: content, globals: { theme: "dark" } };
