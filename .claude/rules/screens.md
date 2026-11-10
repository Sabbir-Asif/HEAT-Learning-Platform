---
paths:
  - "apps/frontend-public/src/**/*.tsx"
  - "apps/frontend-internal/src/**/*.tsx"
---

# Screens

- Build from `@heat/ui` components only; no one-off component in an app.
- No inline `style`, no arbitrary Tailwind values, no app-level CSS files.
- Tailwind in apps is for layout only: grid, flex, gap and spacing tokens.
- Every screen has loading, empty and error states and works at phone and laptop width, light and dark.
- Mutations go through the generated `@heat/api-client` hooks. No Server Actions.
- Copy is English only. No decorative elements.
