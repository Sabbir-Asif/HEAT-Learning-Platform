import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent } from "storybook/test";
import { PageError, PageLoading } from "./page-states";

const meta = {
  title: "Shell/PageStates",
  component: PageError,
  tags: ["test"],
  args: { onRetry: fn() },
} satisfies Meta<typeof PageError>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Error: Story = {
  play: async ({ canvas, args }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Retry" }));
    await expect(args.onRetry).toHaveBeenCalledOnce();
  },
};

export const Loading: Story = {
  render: () => <PageLoading />,
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("status")).toHaveTextContent("Loading");
  },
};

export const ErrorDark: Story = { ...Error, globals: { theme: "dark" } };

export const LoadingDark: Story = { ...Loading, globals: { theme: "dark" } };
