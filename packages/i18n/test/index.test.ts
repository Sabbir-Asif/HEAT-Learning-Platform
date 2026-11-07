import { expect, test } from "vitest";
import { packageName } from "../src/index";

test("exports its package name", () => {
  expect(packageName).toBe("@heat/i18n");
});
