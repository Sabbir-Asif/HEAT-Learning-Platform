import type { Meta, StoryObj } from "@storybook/react-vite";
import { EllipsisIcon } from "lucide-react";
import { expect, screen, userEvent, waitFor } from "storybook/test";
import { Button } from "./button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./dropdown-menu";

const meta = {
  title: "Primitives/DropdownMenu",
  component: DropdownMenu,
  tags: ["test"],
} satisfies Meta<typeof DropdownMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

const menu = (defaultOpen: boolean) => (
  <div className="p-4">
    <DropdownMenu defaultOpen={defaultOpen}>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="Row actions" />}>
        <EllipsisIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuGroup>
          <DropdownMenuLabel>Student</DropdownMenuLabel>
          <DropdownMenuItem>View profile</DropdownMenuItem>
          <DropdownMenuItem>Reset password</DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive">Remove</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
);

export const Default: Story = { render: () => menu(false) };

export const Light: Story = { render: () => menu(false), globals: { theme: "light" } };

export const Dark: Story = { render: () => menu(false), globals: { theme: "dark" } };

export const Open: Story = { render: () => menu(true) };

export const OpenDark: Story = { render: () => menu(true), globals: { theme: "dark" } };

export const Keyboard: Story = {
  render: () => menu(false),
  play: async ({ canvas }) => {
    const trigger = canvas.getByRole("button", { name: "Row actions" });
    trigger.focus();
    await userEvent.keyboard("{Enter}");
    const items = await screen.findAllByRole("menuitem");
    await waitFor(() =>
      expect(screen.getByRole("menu").contains(document.activeElement)).toBe(true),
    );
    await userEvent.keyboard("{ArrowDown}");
    await expect(items.some((item) => item === document.activeElement)).toBe(true);
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    await expect(trigger).toHaveFocus();
  },
};
