import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
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
    const trigger = within(canvasElement).getByRole("button", { name: "Choose theme" });
    await expect(trigger).toBeVisible();
    trigger.focus();
    await userEvent.keyboard("{Enter}");
    const menu = within(document.body);
    await expect(await menu.findByRole("menuitemradio", { name: "Light" })).toBeVisible();
    await expect(menu.getByRole("menuitemradio", { name: "Dark" })).toBeVisible();
    await expect(menu.getByRole("menuitemradio", { name: "System" })).toBeVisible();
    await userEvent.keyboard("{Escape}");
  },
};

export const Light: Story = { ...Default, globals: { theme: "light" } };

export const Dark: Story = { ...Default, globals: { theme: "dark" } };
