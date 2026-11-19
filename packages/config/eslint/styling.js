import css from "@eslint/css";
import { resolve } from "node:path";
import betterTailwindcss from "eslint-plugin-better-tailwindcss";
import { getDefaultSelectors } from "eslint-plugin-better-tailwindcss/defaults";
import { MatcherType, SelectorKind } from "eslint-plugin-better-tailwindcss/types";
import { cssEntryOnly } from "./css-entry-rule.js";

const sourceFiles = ["src/**/*.{js,jsx,ts,tsx}"];
const plugins = { "better-tailwindcss": betterTailwindcss };
const settings = {
  "better-tailwindcss": {
    entryPoint: resolve(import.meta.dirname, "tailwind-entry.css"),
    selectors: [
      ...getDefaultSelectors(),
      {
        kind: SelectorKind.Attribute,
        name: "^(?:.+[cC]lass(?:Name)?s?|classNames)$",
        match: [{ type: MatcherType.String }, { type: MatcherType.ObjectValue }],
      },
    ],
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
