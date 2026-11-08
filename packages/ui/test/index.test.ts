import { expect, test } from "vitest";
import * as ui from "../src/index";

test("exports its package name", () => {
  expect(ui.packageName).toBe("@heat/ui");
});

test.each([
  "ConfirmDialog",
  "EmptyState",
  "ErrorState",
  "PageHeader",
  "PageHeaderAction",
  "StatCard",
  "StatusBadge",
  "resolveStatus",
])("exports %s", (name) => {
  expect(ui).toHaveProperty(name);
});
