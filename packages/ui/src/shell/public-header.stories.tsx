import type { Meta, StoryObj } from "@storybook/react-vite";
import { LogInIcon, UserPlusIcon } from "lucide-react";
import { expect } from "storybook/test";
import { buttonVariants } from "../components/button";
import { fixtureItems, fixtureLogo } from "./fixtures";
import { PublicHeader } from "./public-header";
import { ThemeSwitch } from "./theme-switch";

const meta = {
  title: "Shell/PublicHeader",
  component: PublicHeader,
  tags: ["test"],
  parameters: { layout: "fullscreen" },
  args: {
    brand: {
      name: "HEAT Safety Training",
      subtitle: "University of Dhaka",
      href: "/",
      logos: [fixtureLogo],
    },
    items: fixtureItems,
    pathname: "/learn",
    actions: (
      <>
        <ThemeSwitch />
        <a href="/sign-in" className={buttonVariants({ variant: "outline", size: "lg" })}>
          <LogInIcon aria-hidden="true" />
          Sign in
        </a>
        <a href="/enroll" className={buttonVariants({ size: "lg" })}>
          <UserPlusIcon aria-hidden="true" />
          Enroll
        </a>
      </>
    ),
  },
} satisfies Meta<typeof PublicHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("banner")).toBeVisible();
    await expect(canvas.getByRole("link", { name: "Enroll" })).toBeVisible();
  },
};

export const Light: Story = { ...Default, globals: { theme: "light" } };

export const Dark: Story = { ...Default, globals: { theme: "dark" } };
