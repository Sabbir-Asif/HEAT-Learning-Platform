import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { statusEntries, type StatusKey } from "./status";
import { StatusBadge } from "./status-badge";

const meta = {
  title: "Composites/StatusBadge",
  component: StatusBadge,
  tags: ["test"],
} satisfies Meta<typeof StatusBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

const keys = Object.keys(statusEntries) as StatusKey[];

const all = () => (
  <div className="flex flex-wrap gap-2 p-4">
    {keys.map((key) => {
      const [kind, status] = key.split(".") as ["enrollment" | "video" | "course" | "news", string];
      return <StatusBadge key={key} kind={kind} status={status} />;
    })}
    <StatusBadge kind="enrollment" status="SOMETHING_NEW" />
  </div>
);

export const Default: Story = {
  args: { kind: "enrollment", status: "APPROVED" },
  render: all,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Pending approval")).toBeVisible();
    await expect(canvas.getByText("SOMETHING_NEW")).toBeVisible();
  },
};

export const Light: Story = { ...Default, globals: { theme: "light" } };

export const Dark: Story = { ...Default, globals: { theme: "dark" } };
