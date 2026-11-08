import { ESLint } from "eslint";
import { describe, expect, test } from "vitest";

const configs = {};
const configFor = async (preset) => {
  configs[preset] ??= (await import(`../eslint/${preset}.js`)).default;
  return configs[preset];
};

const run = async (preset, code, filePath, fix = false) => {
  const eslint = new ESLint({
    overrideConfigFile: true,
    overrideConfig: await configFor(preset),
    fix,
  });
  const [result] = await eslint.lintText(code, { filePath });
  return result;
};

const lint = async (preset, code, filePath) => (await run(preset, code, filePath)).messages;

const appFile = "src/app/page.tsx";
const uiFile = "src/button/button.tsx";
const markup = (classes) => `export const a = <div className="${classes}" />;\n`;

describe("class conflicts and order are errors", () => {
  for (const [preset, file] of [
    ["app", appFile],
    ["ui", uiFile],
  ]) {
    test(`${preset} reports conflicting classes as errors`, async () => {
      for (const classes of ["p-2 p-4", "flex grid"]) {
        const messages = await lint(preset, markup(classes), file);
        const conflict = messages.find(
          (message) => message.ruleId === "better-tailwindcss/no-conflicting-classes",
        );
        expect(conflict?.severity).toBe(2);
      }
    });

    test(`${preset} reports misordered classes as errors and fixes them`, async () => {
      const messages = await lint(preset, markup("p-4 flex"), file);
      const order = messages.find(
        (message) => message.ruleId === "better-tailwindcss/enforce-consistent-class-order",
      );
      expect(order?.severity).toBe(2);
      const fixed = await run(preset, markup("p-4 flex"), file, true);
      expect(fixed.output).toBe(markup("flex p-4"));
    });

    test(`${preset} accepts ordered, non-conflicting classes`, async () => {
      expect(await lint(preset, markup("flex gap-4 p-4"), file)).toEqual([]);
    });
  }
});

const restricted = (messages) =>
  messages.filter((message) => message.ruleId === "better-tailwindcss/no-restricted-classes");

describe("arbitrary values", () => {
  const arbitrary = ["mt-[13px]", "md:w-[40%]", "[&>*]:p-2", "bg-[var(--x)]"];

  for (const className of arbitrary) {
    test(`app rejects ${className} in a className string and names it`, async () => {
      const messages = restricted(await lint("app", markup(className), appFile));
      expect(messages).toHaveLength(1);
      expect(messages[0].message).toContain(className);
      expect(messages[0].message).toContain("@heat/ui");
    });

    test(`ui accepts ${className}`, async () => {
      expect(restricted(await lint("ui", markup(className), uiFile))).toEqual([]);
    });
  }

  test("app rejects arbitrary values in template literals and class helpers", async () => {
    const sources = [
      "export const a = <div className={`mt-[13px] ${x}`} />;\n",
      'export const a = <div className={cn("flex", "mt-[13px]")} />;\n',
      'export const a = <div className={clsx("flex", { "mt-[13px]": on })} />;\n',
      'export const a = cva("flex", { variants: { size: { sm: "mt-[13px]" } } });\n',
    ];
    for (const source of sources) {
      expect(restricted(await lint("app", source, appFile)), source).toHaveLength(1);
    }
  });

  test("app ignores non-literal expressions without crashing", async () => {
    const sources = [
      "export const a = <div className={x} />;\n",
      "export const a = <div className={font.className} />;\n",
      "export const a = <div className={cn(x, y)} />;\n",
    ];
    for (const source of sources) {
      expect(await lint("app", source, appFile), source).toEqual([]);
    }
  });
});

describe("layout-only classes in apps", () => {
  const allowed = [
    "flex flex-col gap-4",
    "md:grid md:grid-cols-3 lg:gap-x-6",
    "p-4 px-2 -mt-2 m-auto mx-4",
    "w-1/2 h-screen size-8 min-h-0 max-w-screen-md",
    "items-center justify-between self-end place-items-center content-start order-2",
    "overflow-hidden overflow-x-auto container hidden sm:block inline-flex contents",
    "space-y-2 col-span-2 row-span-1 grow shrink-0 basis-1/3 2xl:p-8",
  ];
  const disallowed = [
    "bg-red-500",
    "text-lg",
    "font-bold",
    "rounded",
    "shadow-md",
    "border",
    "opacity-50",
    "dark:flex",
    "hover:p-2",
    "md:bg-red-500",
    "absolute",
    "p",
  ];

  for (const classes of allowed) {
    test(`app accepts ${classes}`, async () => {
      expect(restricted(await lint("app", markup(classes), appFile))).toEqual([]);
    });
  }

  for (const className of disallowed) {
    test(`app rejects ${className}, names it and points to @heat/ui`, async () => {
      const messages = restricted(await lint("app", markup(className), appFile));
      expect(messages).toHaveLength(1);
      expect(messages[0].message).toContain(`'${className}'`);
      expect(messages[0].message).toContain("@heat/ui");
    });

    test(`ui accepts ${className}`, async () => {
      expect(restricted(await lint("ui", markup(className), uiFile))).toEqual([]);
    });
  }

  test("an arbitrary value is reported once, as an arbitrary value", async () => {
    const messages = restricted(await lint("app", markup("mt-[13px]"), appFile));
    expect(messages).toHaveLength(1);
    expect(messages[0].message).toContain("Arbitrary value");
  });
});

describe("inline styles, style elements and extra stylesheets", () => {
  const syntax = (messages) =>
    messages.filter((message) => message.ruleId === "no-restricted-syntax");
  const banned = {
    "a style attribute on an element": 'export const a = <div style={{ color: "red" }} />;\n',
    "a style attribute on a component": "export const a = <Card style={styles} />;\n",
    "a style element": 'export const a = <style>{"a { color: red }"}</style>;\n',
    "a CSS module import": 'import styles from "./card.module.css";\nexport const a = styles;\n',
    "a Sass import": 'import "./card.scss";\n',
    "a second stylesheet import": 'import "../styles/other.css";\n',
  };

  for (const [name, source] of Object.entries(banned)) {
    test(`app rejects ${name}`, async () => {
      const messages = syntax(await lint("app", source, appFile));
      expect(messages).toHaveLength(1);
      expect(messages[0].message).toContain("@heat/ui");
    });

    test(`ui accepts ${name}`, async () => {
      expect(syntax(await lint("ui", source, uiFile))).toEqual([]);
    });
  }

  test("app accepts the single globals.css entry import", async () => {
    expect(syntax(await lint("app", 'import "./globals.css";\n', appFile))).toEqual([]);
    expect(syntax(await lint("app", 'import "@/app/globals.css";\n', appFile))).toEqual([]);
  });

  test("app accepts a class name and a non-style attribute", async () => {
    expect(syntax(await lint("app", markup("flex"), appFile))).toEqual([]);
  });
});
