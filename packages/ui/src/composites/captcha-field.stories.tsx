import type { Meta, StoryObj } from "@storybook/react-vite";
import * as React from "react";
import { expect, fn, userEvent, within } from "storybook/test";
import { CaptchaField } from "./captcha-field";
import type { CaptchaFieldProps } from "./captcha-field";

const sampleSvg =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 190 64" width="190" height="64"><rect width="190" height="64" fill="white"/><path d="M20 50 L35 14 L50 50 M26 38 L44 38" fill="none" stroke="black" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M70 16 L98 16 L70 50 L98 50" fill="none" stroke="black" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M120 14 L120 50 M120 32 L150 14 M128 28 L150 50" fill="none" stroke="black" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M0 40 C60 10 120 60 190 20" fill="none" stroke="gray" stroke-width="1.2"/></svg>';

function Demo(props: Partial<CaptchaFieldProps>) {
  const [value, setValue] = React.useState("");
  return (
    <div className="max-w-sm p-4">
      <CaptchaField
        status="ready"
        svg={sampleSvg}
        supportContact="support@heat.du.ac.bd"
        onRefresh={() => undefined}
        {...props}
        value={value}
        onChange={setValue}
      />
    </div>
  );
}

const meta = {
  title: "Composites/CaptchaField",
  component: Demo,
  tags: ["test"],
} satisfies Meta<typeof Demo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { onRefresh: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("img")).toBeVisible();
    await expect(canvas.getByText(/support@heat\.du\.ac\.bd/)).toBeVisible();
    await userEvent.type(canvas.getByLabelText("Security check"), "AK7");
    await expect(canvas.getByLabelText("Security check")).toHaveValue("AK7");
    await userEvent.click(canvas.getByRole("button", { name: "Get a new image" }));
    await expect(args.onRefresh).toHaveBeenCalled();
  },
};

export const Light: Story = { ...Default, globals: { theme: "light" } };

export const Dark: Story = { ...Default, globals: { theme: "dark" } };

export const Loading: Story = {
  args: { status: "loading", svg: undefined },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("status")).toHaveTextContent("Loading security check");
    await expect(canvas.getByRole("button", { name: "Get a new image" })).toBeDisabled();
  },
};

export const LoadingDark: Story = { ...Loading, globals: { theme: "dark" } };

export const LoadFailed: Story = {
  args: { status: "error", svg: undefined },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("alert")).toHaveTextContent("could not be loaded");
  },
};

export const WithError: Story = {
  args: { error: "The characters do not match. Try again." },
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByLabelText("Security check");
    await expect(input).toHaveAttribute("aria-invalid", "true");
    await expect(input).toHaveAccessibleDescription(/Type the letters/);
  },
};

export const WithErrorDark: Story = { ...WithError, globals: { theme: "dark" } };

export const SupportLink: Story = {
  args: { supportHref: "mailto:support@heat.du.ac.bd" },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("link", { name: "Contact support@heat.du.ac.bd" }),
    ).toHaveAttribute("href", "mailto:support@heat.du.ac.bd");
  },
};
