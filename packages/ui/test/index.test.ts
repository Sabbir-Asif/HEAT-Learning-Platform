import { expect, test } from "vitest";
import * as ui from "../src/index";

const primitives = [
  "Badge",
  "Breadcrumb",
  "Button",
  "Card",
  "Checkbox",
  "Combobox",
  "Dialog",
  "DropdownMenu",
  "Field",
  "Input",
  "InputGroup",
  "Label",
  "Progress",
  "RadioGroup",
  "Select",
  "Separator",
  "Sheet",
  "Sidebar",
  "SidebarProvider",
  "Skeleton",
  "Tabs",
  "Textarea",
  "Toaster",
  "Tooltip",
];

test("exports its package name", () => {
  expect(ui.packageName).toBe("@heat/ui");
});

test.each(primitives)("exports %s", (name) => {
  expect(ui).toHaveProperty(name);
});

test("exports the theme provider and the class helper", () => {
  expect(ui.ThemeProvider).toBeTypeOf("function");
  expect(ui.cn("a", "b")).toBe("a b");
});
