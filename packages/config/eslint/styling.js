import css from "@eslint/css";
import { resolve } from "node:path";
import betterTailwindcss from "eslint-plugin-better-tailwindcss";
import { cssEntryOnly } from "./css-entry-rule.js";

const sourceFiles = ["src/**/*.{ts,tsx}"];
const plugins = { "better-tailwindcss": betterTailwindcss };
const settings = {
  "better-tailwindcss": {
    entryPoint: resolve(import.meta.dirname, "tailwind-entry.css"),
  },
};

export const classOrderConfig = {
  files: sourceFiles,
  plugins,
  settings,
  rules: {
    "better-tailwindcss/no-conflicting-classes": "error",
    "better-tailwindcss/enforce-consistent-class-order": "error",
  },
};

const breakpointVariants = "(?:(?:max-)?(?:sm|md|lg|xl|2xl):)*";
const layoutWords = [
  "flex",
  "grid",
  "block",
  "hidden",
  "contents",
  "inline",
  "inline-block",
  "inline-flex",
  "inline-grid",
  "container",
  "grow",
  "shrink",
];
const layoutPrefixes = [
  "flex",
  "grid",
  "col",
  "row",
  "gap",
  "gap-x",
  "gap-y",
  "space-x",
  "space-y",
  "items",
  "justify",
  "content",
  "place",
  "self",
  "order",
  "grow",
  "shrink",
  "basis",
  "p",
  "px",
  "py",
  "pt",
  "pr",
  "pb",
  "pl",
  "ps",
  "pe",
  "m",
  "mx",
  "my",
  "mt",
  "mr",
  "mb",
  "ml",
  "ms",
  "me",
  "w",
  "h",
  "size",
  "min-w",
  "min-h",
  "max-w",
  "max-h",
  "overflow",
  "overflow-x",
  "overflow-y",
];
const layoutClass = `${breakpointVariants}-?(?:${layoutWords.join("|")}|(?:${layoutPrefixes.join("|")})-[a-z0-9./-]+)`;

const restrictedClasses = [
  {
    pattern: "^(.*\\[.*)$",
    message: "Arbitrary value '$1' is not allowed in an app. Add a token or a variant to @heat/ui.",
  },
  {
    pattern: `^(?![^\\[]*\\[)(?!${layoutClass}$)(.+)$`,
    message:
      "Class '$1' is not a layout utility. Apps may only lay out; styling lives in a @heat/ui component.",
  },
];

const stylesheetImport = "ImportDeclaration[source.value=/\\.(?:css|scss|sass|less)$/]";
const entryStylesheet = "[source.value=/^(?:\\.|@\\/app)\\/globals\\.css$/]";

const restrictedSyntax = [
  {
    selector: "JSXAttribute[name.name='style']",
    message: "Inline style is not allowed in an app. Styling lives in a @heat/ui component.",
  },
  {
    selector: "JSXOpeningElement[name.name='style']",
    message: "A style element is not allowed in an app. Styling lives in @heat/ui.",
  },
  {
    selector: `${stylesheetImport}:not(${entryStylesheet})`,
    message: "Only the globals.css entry may be imported in an app. Other styles live in @heat/ui.",
  },
];

export const appStylingConfig = {
  files: sourceFiles,
  plugins,
  settings,
  rules: {
    "no-restricted-syntax": ["error", ...restrictedSyntax],
    "better-tailwindcss/no-restricted-classes": ["error", { restrict: restrictedClasses }],
  },
};

export const appCssConfig = {
  files: ["**/*.css"],
  plugins: { css, "heat-styling": { rules: { "css-entry-only": cssEntryOnly } } },
  language: "css/css",
  languageOptions: { tolerant: true },
  rules: { "heat-styling/css-entry-only": "error" },
};

const scriptFiles = ["**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}"];

export const scopeToScripts = (configs) =>
  configs.map((config) => {
    const globalIgnores = Object.keys(config).length === 1 && "ignores" in config;
    return globalIgnores || config.files ? config : { ...config, files: scriptFiles };
  });
