import { expect, test } from "vitest";
import { maskAddress } from "../../../src/core/mail/mask-address";

test("keeps the first character of the local part and the domain", () => {
  expect(maskAddress("learner@example.test")).toBe("l***@example.test");
});

test("masks a single character local part and malformed values", () => {
  expect(maskAddress("a@example.test")).toBe("a***@example.test");
  expect(maskAddress("not-an-address")).toBe("***");
  expect(maskAddress("")).toBe("***");
});
