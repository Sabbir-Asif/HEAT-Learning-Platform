import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { NotificationsLink } from "./notifications-link";

const meta = {
  title: "Shell/NotificationsLink",
  component: NotificationsLink,
  tags: ["test"],
  args: { href: "/notifications" },
} satisfies Meta<typeof NotificationsLink>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("link", { name: "Notifications" })).toBeVisible();
  },
};

export const Unread: Story = {
  args: { count: 12 },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("link", { name: "Notifications, 12 unread" }),
    ).toBeVisible();
  },
};

export const OverNinetyNine: Story = {
  args: { count: 250 },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("link", { name: "Notifications, 99+ unread" }),
    ).toBeVisible();
  },
};

export const Light: Story = { ...Unread, globals: { theme: "light" } };

export const Dark: Story = { ...Unread, globals: { theme: "dark" } };
