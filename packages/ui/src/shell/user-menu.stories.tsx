import type { Meta, StoryObj } from "@storybook/react-vite";
import { UserIcon } from "lucide-react";
import { expect, userEvent, within } from "storybook/test";
import { UserMenu } from "./user-menu";

const meta = {
  title: "Shell/UserMenu",
  component: UserMenu,
  tags: ["test"],
  args: {
    name: "Amina Rahman",
    email: "amina.rahman@example.edu",
    items: [{ href: "/profile", label: "Profile", icon: UserIcon }],
  },
} satisfies Meta<typeof UserMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole("button", { name: /Amina Rahman/ });
    trigger.focus();
    await userEvent.keyboard("{Enter}");
    await expect(
      await within(document.body).findByRole("menuitem", { name: "Profile" }),
    ).toBeVisible();
    await userEvent.keyboard("{Escape}");
  },
};

export const LongName: Story = {
  args: {
    name: "Muhammad Abdullah Al Mahmud Chowdhury Rahman",
    email: "muhammad.abdullah.al.mahmud.chowdhury.rahman@science.du.ac.bd",
  },
};

export const Light: Story = { ...Default, globals: { theme: "light" } };

export const Dark: Story = { ...Default, globals: { theme: "dark" } };
