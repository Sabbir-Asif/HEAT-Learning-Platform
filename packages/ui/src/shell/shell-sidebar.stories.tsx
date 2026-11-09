import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { SidebarProvider } from "../components/sidebar";
import { fixtureGroups, fixtureLogo } from "./fixtures";
import { ShellSidebar } from "./shell-sidebar";

const meta = {
  title: "Shell/ShellSidebar",
  component: ShellSidebar,
  tags: ["test"],
  parameters: { layout: "fullscreen" },
  args: {
    brand: { name: "HEAT Admin", href: "/", logo: fixtureLogo },
    groups: fixtureGroups,
    pathname: "/learn/course",
    navLabel: "Main",
  },
  decorators: [
    (Story) => (
      <SidebarProvider>
        <Story />
      </SidebarProvider>
    ),
  ],
} satisfies Meta<typeof ShellSidebar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("navigation", { name: "Main" })).toBeVisible();
    await expect(canvas.getByRole("link", { name: "My Learning" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(canvas.getByRole("link", { name: "Dashboard" })).not.toHaveAttribute(
      "aria-current",
    );
  },
};

export const Drawer: Story = { ...Default, args: { mode: "drawer" } };

export const Light: Story = { ...Default, globals: { theme: "light" } };

export const Dark: Story = { ...Default, globals: { theme: "dark" } };
