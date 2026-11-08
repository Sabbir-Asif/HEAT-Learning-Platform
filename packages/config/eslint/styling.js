import betterTailwindcss from "eslint-plugin-better-tailwindcss";

const sourceFiles = ["src/**/*.{ts,tsx}"];

export const classOrderRules = {
  "better-tailwindcss/no-conflicting-classes": "error",
  "better-tailwindcss/enforce-consistent-class-order": "error",
};

export const classOrderConfig = {
  files: sourceFiles,
  plugins: { "better-tailwindcss": betterTailwindcss },
  rules: classOrderRules,
};
