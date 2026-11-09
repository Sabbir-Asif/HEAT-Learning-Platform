import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";
import { ThemeProvider } from "../theme/theme-provider";
import { ThemeSwitch } from "./theme-switch";

const meta = {
  title: "Shell/ThemeSwitch",
  component: ThemeSwitch,
  tags: ["test"],
  decorators: [
    (Story) => (
      <ThemeProvider>
        <Story />
      </ThemeProvider>
    ),
  ],
} satisfies Meta<typeof ThemeSwitch>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("button", { name: "Choose theme" })).toBeVisible();
  },
};

export const Keyboard: Story = {
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole("button", { name: "Choose theme" });
    trigger.focus();
    await userEvent.keyboard("{Enter}");
    await expect(await screen.findByRole("menuitemradio", { name: "Light" })).toBeVisible();
    await expect(screen.getByRole("menuitemradio", { name: "Dark" })).toBeVisible();
    await expect(screen.getByRole("menuitemradio", { name: "System" })).toBeVisible();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    await expect(trigger).toHaveFocus();
  },
};

export const Light: Story = { ...Default, globals: { theme: "light" } };

export const Dark: Story = { ...Default, globals: { theme: "dark" } };
