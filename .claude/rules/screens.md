---
paths:
  - "apps/frontend-public/src/**/*.tsx"
  - "apps/frontend-internal/src/**/*.tsx"
---

# Screens

- Prefer `@heat/ui` components. App-specific components are fine when they use the design tokens.
- Apps may style with Tailwind classes and token colours, including arbitrary values. No app-level CSS files.
- Every screen has loading, empty and error states and works at phone and laptop width, light and dark.
- Mutations go through the generated `@heat/api-client` hooks. No Server Actions.
- Copy is English only.
