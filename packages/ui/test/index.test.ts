import { expect, test } from "vitest";
import * as ui from "../src/index";

test("exports its package name", () => {
  expect(ui.packageName).toBe("@heat/ui");
});

test.each([
  "CaptchaField",
  "ConfirmDialog",
  "EmptyState",
  "ErrorState",
  "Form",
  "FormField",
  "FormMessage",
  "PageHeader",
  "PageHeaderAction",
  "SectionHeading",
  "SortableList",
  "StatCard",
  "StatusBadge",
  "resolveStatus",
])("exports %s", (name) => {
  expect(ui).toHaveProperty(name);
});
