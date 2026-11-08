import { describe, expect, test } from "vitest";
import { serializeDocument } from "../../src/openapi/serialize";

describe("serializeDocument", () => {
  test("sorts object keys at every depth, whatever the insertion order", () => {
    const a = { b: 1, a: { d: 1, c: [{ y: 1, x: 2 }] } };
    const b = { a: { c: [{ x: 2, y: 1 }], d: 1 }, b: 1 };
    expect(serializeDocument(a)).toBe(serializeDocument(b));
    expect(serializeDocument(a).indexOf('"a"')).toBeLessThan(serializeDocument(a).indexOf('"b"'));
  });

  test("keeps array order, which is meaningful (enum, required, parameters)", () => {
    expect(JSON.parse(serializeDocument({ list: ["z", "a", "m"] }))).toEqual({
      list: ["z", "a", "m"],
    });
  });

  test("indents with two spaces and ends with one newline", () => {
    expect(serializeDocument({ a: { b: 1 } })).toBe('{\n  "a": {\n    "b": 1\n  }\n}\n');
  });
});
