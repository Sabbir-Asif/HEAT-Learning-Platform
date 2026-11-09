import { describe, expect, test } from "vitest";
import { academicSessionSchema } from "../src/index";

describe("academicSessionSchema", () => {
  test.each(["2020-21", "2019-20", "1999-00", "2099-00"])("accepts %s", (value) => {
    expect(academicSessionSchema.safeParse(value).success).toBe(true);
  });

  test.each(["2020-23", "2020-20", "20-21", "2020-2", "2020/21", "2020-21 ", "", "abcd-ef"])(
    "rejects %j",
    (value) => {
      expect(academicSessionSchema.safeParse(value).success).toBe(false);
    },
  );

  test("rejects a value that is not a string", () => {
    expect(academicSessionSchema.safeParse(2020).success).toBe(false);
  });
});
