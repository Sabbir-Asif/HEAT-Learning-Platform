import { describe, expect, test } from "vitest";
import { csvByteOrderMark, csvCell, csvLine, neutraliseFormula } from "../../src/students/csv";

describe("neutraliseFormula", () => {
  test.each(["=1+1", "+1", "-1", "@SUM(A1)", "\tcmd", "\rcmd"])("prefixes %j", (value) => {
    expect(neutraliseFormula(value)).toBe(`'${value}`);
  });

  test("leaves ordinary text and empty values alone", () => {
    expect(neutraliseFormula("Rahim")).toBe("Rahim");
    expect(neutraliseFormula("")).toBe("");
    expect(neutraliseFormula("a=b")).toBe("a=b");
  });
});

describe("csvCell", () => {
  test("quotes commas, quotes and line breaks", () => {
    expect(csvCell("Rahman, Abdul")).toBe('"Rahman, Abdul"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("line\nbreak")).toBe('"line\nbreak"');
  });

  test("neutralises a formula and still quotes it when needed", () => {
    expect(csvCell("=HYPERLINK(a,b)")).toBe('"\'=HYPERLINK(a,b)"');
    expect(csvCell("@user")).toBe("'@user");
  });

  test("keeps non-latin characters intact", () => {
    expect(csvCell("Zoë Åström")).toBe("Zoë Åström");
  });
});

describe("csvLine", () => {
  test("joins cells and ends with CRLF", () => {
    expect(csvLine(["a", "b,c", ""])).toBe('a,"b,c",\r\n');
  });

  test("exposes the byte order mark for Excel", () => {
    expect(csvByteOrderMark).toBe("﻿");
  });
});
