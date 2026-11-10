---
paths:
  - "**/*.test.ts"
  - "**/*.test.tsx"
  - "**/*.test.mjs"
---

# Tests

- Write the failing test first, then the code, then refactor.
- No comments in test files; the test name states the rule.
- Integration tests use a real Postgres through the `@heat/db/testing` harness, never a mock of the database.
- Unlock, scoring and certificate rules need 100% coverage; domain services 85%.
- A test asserts behaviour a user or caller can observe, not private structure.
