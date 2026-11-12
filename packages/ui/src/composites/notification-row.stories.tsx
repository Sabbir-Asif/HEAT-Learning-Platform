import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { NotificationRow } from "./notification-row";

const meta = {
  title: "Composites/NotificationRow",
  component: NotificationRow,
  tags: ["test"],
  decorators: [
    (Story) => (
      <ul>
        <Story />
      </ul>
    ),
  ],
  args: {
    title: "Your enrollment was approved",
    description: "You can start the course now.",
    timeLabel: "12 November 2026, 10:00",
    unread: true,
    onMarkRead: () => undefined,
  },
} satisfies Meta<typeof NotificationRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Unread: Story = {
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("button", { name: "Mark as read" }),
    ).toBeInTheDocument();
  },
};

export const Read: Story = { args: { unread: false } };

export const UnreadLight: Story = { ...Unread, globals: { theme: "light" } };

export const UnreadDark: Story = { ...Unread, globals: { theme: "dark" } };
