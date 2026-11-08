import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent } from "storybook/test";
import { LocaleSwitch } from "./locale-switch";

const options = [
  { value: "bn", label: "বাংলা", href: "/bn/courses/safety?tab=2" },
  { value: "en", label: "English", href: "/en/courses/safety?tab=2" },
];

const meta = {
  title: "LocaleSwitch",
  component: LocaleSwitch,
  tags: ["test"],
  args: { label: "Language", current: "en", options, onChange: fn() },
  render: (args, { globals }) => {
    const bangla = globals["locale"] === "bn";
    return (
      <div style={{ width: 360 }}>
        <LocaleSwitch
          {...args}
          label={bangla ? "ভাষা" : args.label}
          current={bangla ? "bn" : "en"}
        />
      </div>
    );
  },
} satisfies Meta<typeof LocaleSwitch>;

export default meta;
type Story = StoryObj<typeof meta>;

const expectStructure: NonNullable<Story["play"]> = async ({ canvas, canvasElement, args }) => {
  const bangla = document.documentElement.lang === "bn";
  const nav = canvas.getByRole("navigation", { name: bangla ? "ভাষা" : "Language" });
  const [bn, en] = [canvas.getByText("বাংলা"), canvas.getByText("English")];
  await expect(bn.tagName).toBe("A");
  await expect(en.tagName).toBe("A");
  await expect(bn).toHaveAttribute("lang", "bn");
  await expect(bn).toHaveAttribute("hreflang", "bn");
  await expect(en).toHaveAttribute("lang", "en");
  await expect(en).toHaveAttribute("hreflang", "en");
  await expect(bangla ? bn : en).toHaveAttribute("aria-current", "true");
  await expect(bangla ? en : bn).not.toHaveAttribute("aria-current");
  await expect(nav.scrollWidth).toBeLessThanOrEqual(nav.clientWidth);
  await expect(canvasElement.querySelectorAll("a")).toHaveLength(args.options.length);
  for (const link of [bn, en]) {
    const box = link.getBoundingClientRect();
    await expect(box.width).toBeGreaterThanOrEqual(24);
    await expect(box.height).toBeGreaterThanOrEqual(24);
  }
};

const expectKeyboard: NonNullable<Story["play"]> = async ({ canvas, args }) => {
  const bangla = document.documentElement.lang === "bn";
  const other = canvas.getByText(bangla ? "English" : "বাংলা");
  const onChange = args.onChange;
  await expect(onChange).toBeDefined();
  if (!bangla) {
    await userEvent.tab();
  } else {
    await userEvent.tab();
    await userEvent.tab();
  }
  await expect(other).toHaveFocus();
  const outline = getComputedStyle(other);
  await expect(outline.outlineStyle).toBe("solid");
  await expect(parseFloat(outline.outlineWidth)).toBeGreaterThanOrEqual(2);
  await userEvent.keyboard("{Enter}");
  await expect(onChange).toHaveBeenLastCalledWith(bangla ? "en" : "bn");
};

export const Default: Story = {};

export const LightEnglish: Story = {
  globals: { theme: "light", locale: "en" },
  play: async (context) => {
    await expect(document.documentElement).not.toHaveClass("dark");
    await expectStructure(context);
    await expectKeyboard(context);
  },
};

export const DarkEnglish: Story = {
  globals: { theme: "dark", locale: "en" },
  play: async (context) => {
    await expect(document.documentElement).toHaveClass("dark");
    await expectStructure(context);
    await expectKeyboard(context);
  },
};

export const LightBangla: Story = {
  globals: { theme: "light", locale: "bn" },
  play: async (context) => {
    await expect(document.documentElement).toHaveAttribute("lang", "bn");
    await expectStructure(context);
    await expectKeyboard(context);
  },
};

export const DarkBangla: Story = {
  globals: { theme: "dark", locale: "bn" },
  play: async (context) => {
    await expect(document.documentElement).toHaveClass("dark");
    await expect(document.documentElement).toHaveAttribute("lang", "bn");
    await expectStructure(context);
    await expectKeyboard(context);
  },
};
