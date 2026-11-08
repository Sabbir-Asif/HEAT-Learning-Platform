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
    "sr-only not-sr-only truncate aspect-video aspect-square aspect-4/3",
    "motion-reduce:hidden print:hidden *:p-2 min-md:flex max-sm:hidden",
    "@container @container/main @sm:flex @md:grid-cols-2 @max-lg:hidden @min-xl:p-4 @3xl:gap-2",
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
    "relative",
    "fixed",
    "sticky",
    "z-10",
    "float-left",
    "visible",
    "invisible",
    "motion-reduce:bg-red-500",
    "print:text-lg",
    "@sm:bg-red-500",
    "*:bg-red-500",
    "group-hover:flex",
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

  test("app rejects a globals.css that is not the app entry", async () => {
    for (const path of ["../../styles/globals.css", "./other/globals.css", "./my-globals.css"]) {
      const messages = syntax(await lint("app", `import "${path}";\n`, appFile));
      expect(messages, path).toHaveLength(1);
    }
  });

  test("app accepts a class name and a non-style attribute", async () => {
    expect(syntax(await lint("app", markup("flex"), appFile))).toEqual([]);
  });
});

describe("the single CSS entry in apps", () => {
  const cssRule = (messages) =>
    messages.filter((message) => message.ruleId === "heat-styling/css-entry-only");
  const entry = "src/app/globals.css";
  const entrySource = '@import "@heat/ui/styles.css";\n@source "../../../../packages/ui/src";\n';

  test("a second CSS file fails and the message names it", async () => {
    for (const file of ["src/components/extra.css", "src/app/dashboard/page.css", "src/x.css"]) {
      const messages = cssRule(await lint("app", "a {\n  color: red;\n}\n", file));
      expect(messages, file).toHaveLength(1);
      expect(messages[0].message).toContain(file);
      expect(messages[0].severity).toBe(2);
    }
  });

  test("an empty second CSS file also fails", async () => {
    expect(cssRule(await lint("app", "", "src/empty.css"))).toHaveLength(1);
  });

  test("the entry passes with only the shared import and source lines", async () => {
    expect(await lint("app", entrySource, entry)).toEqual([]);
    expect(await lint("app", '@import "@heat/ui/styles.css";\n', entry)).toEqual([]);
  });

  test("anything else in the entry fails", async () => {
    const extras = [
      ".a {\n  color: red;\n}\n",
      "@theme {\n  --color-x: red;\n}\n",
      '@import "other.css";\n',
      '@plugin "x";\n',
      "@utility tab-4 {\n  tab-size: 4;\n}\n",
      "@custom-variant dark (&:where(.dark, .dark *));\n",
      ".a {\n  @apply flex;\n}\n",
    ];
    for (const extra of extras) {
      const messages = await lint("app", entrySource + extra, entry);
      expect(
        messages.map((message) => message.ruleId),
        extra,
      ).toEqual(["heat-styling/css-entry-only"]);
    }
  });

  test("CSS anywhere in the app package fails, not only under src", async () => {
    for (const file of ["styles/extra.css", "public/x.css", "test/fixture.css", "src/styles.css"]) {
      const messages = cssRule(await lint("app", "a {\n  color: red;\n}\n", file));
      expect(messages, file).toHaveLength(1);
      expect(messages[0].message).toContain(file);
    }
  });

  test("build output and dependencies are not linted as CSS", async () => {
    const app = new ESLint({ overrideConfigFile: true, overrideConfig: await configFor("app") });
    for (const file of [".next/static/x.css", "coverage/x.css", "node_modules/pkg/x.css"]) {
      const [result] = await app.lintText("a {}\n", { filePath: file, warnIgnored: false });
      expect(result?.messages ?? [], file).toEqual([]);
    }
  });

  test("CSS in the ui preset is not reported", async () => {
    const ui = new ESLint({ overrideConfigFile: true, overrideConfig: await configFor("ui") });
    for (const file of ["src/styles.css", ".storybook/preview.css"]) {
      const [result] = await ui.lintText("a {}\n", { filePath: file, warnIgnored: false });
      expect(result?.messages ?? [], file).toEqual([]);
    }
  });
});

describe("the Tailwind entry point", () => {
  for (const [preset, file] of [
    ["app", appFile],
    ["ui", uiFile],
  ]) {
    test(`${preset} reports class problems without an entry point warning`, async () => {
      const messages = await lint(preset, markup("p-2 p-4"), file);
      expect(messages.length).toBeGreaterThan(0);
      for (const message of messages) expect(message.message).not.toMatch(/entry point/i);
    });
  }
});

describe("class-like attributes and plain JavaScript sources", () => {
  const sources = {
    "a containerClassName attribute": 'export const a = <Card containerClassName="mt-[13px]" />;\n',
    "a classNames object": 'export const a = <Card classNames={{ root: "mt-[13px]" }} />;\n',
    "a wrapperClass attribute": 'export const a = <Card wrapperClass="mt-[13px]" />;\n',
  };

  for (const [name, source] of Object.entries(sources)) {
    test(`app rejects ${name}`, async () => {
      expect(restricted(await lint("app", source, appFile))).toHaveLength(1);
    });

    test(`ui accepts ${name}`, async () => {
      expect(restricted(await lint("ui", source, uiFile))).toEqual([]);
    });
  }

  test("app does not treat unrelated attributes as classes", async () => {
    const source = 'export const a = <Card title="mt-[13px]" label="bg-red-500" />;\n';
    expect(restricted(await lint("app", source, appFile))).toEqual([]);
  });

  test("conflicts in a class-like attribute are reported in both presets", async () => {
    const source = 'export const a = <Card containerClassName="p-2 p-4" />;\n';
    for (const [preset, file] of [
      ["app", appFile],
      ["ui", uiFile],
    ]) {
      const found = (await lint(preset, source, file)).map((message) => message.ruleId);
      expect(found).toContain("better-tailwindcss/no-conflicting-classes");
    }
  });

  test("the class and style rules also cover .js and .jsx under src", async () => {
    for (const file of ["src/app/page.jsx", "src/lib/helpers.js"]) {
      const source = 'export const a = <div style={{ color: "red" }} className="mt-[13px]" />;\n';
      const messages = await lint("app", source, file);
      expect(restricted(messages), file).toHaveLength(1);
      expect(
        messages.filter((message) => message.ruleId === "no-restricted-syntax"),
        file,
      ).toHaveLength(1);
    }
  });
});
