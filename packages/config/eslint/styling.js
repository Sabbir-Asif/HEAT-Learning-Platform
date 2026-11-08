import betterTailwindcss from "eslint-plugin-better-tailwindcss";

const sourceFiles = ["src/**/*.{ts,tsx}"];
const plugins = { "better-tailwindcss": betterTailwindcss };

export const classOrderConfig = {
  files: sourceFiles,
  plugins,
  rules: {
    "better-tailwindcss/no-conflicting-classes": "error",
    "better-tailwindcss/enforce-consistent-class-order": "error",
  },
};

const restrictedClasses = [
  {
    pattern: "^(.*\\[.*)$",
    message: "Arbitrary value '$1' is not allowed in an app. Add a token or a variant to @heat/ui.",
  },
];

export const appClassConfig = {
  files: sourceFiles,
  plugins,
  rules: {
    "better-tailwindcss/no-restricted-classes": ["error", { restrict: restrictedClasses }],
  },
};
