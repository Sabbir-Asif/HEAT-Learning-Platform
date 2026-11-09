import { describe, expect, test, vi } from "vitest";
import { buildCsv, csvFileName, downloadCsv, formatDhakaDate } from "../../src/charts/csv";

const columns = [
  { key: "month", label: "Month" },
  { key: "enrolled", label: "Enrolled" },
];

describe("buildCsv", () => {
  test("starts with a byte order mark and uses the labels as the header", () => {
    const csv = buildCsv(columns, [{ month: "Oct", enrolled: 12 }]);
    expect(csv.startsWith("﻿Month,Enrolled\r\n")).toBe(true);
  });

  test("writes exactly the rows given, in column order", () => {
    const csv = buildCsv(columns, [
      { enrolled: 12, month: "Oct" },
      { enrolled: 20, month: "Nov", ignored: "x" },
    ]);
    expect(csv).toBe("﻿Month,Enrolled\r\nOct,12\r\nNov,20");
  });

  test("keeps a header row for no rows", () => {
    expect(buildCsv(columns, [])).toBe("﻿Month,Enrolled");
  });

  test("writes null, undefined and empty strings as empty cells", () => {
    const csv = buildCsv(columns, [
      { month: null, enrolled: undefined },
      { month: "", enrolled: 0 },
    ]);
    expect(csv).toBe("﻿Month,Enrolled\r\n,\r\n,0");
  });

  test.each(["=", "+", "-", "@", "\t", "\r"])(
    "neutralises a text cell that starts with %j",
    (trigger) => {
      const csv = buildCsv(columns, [{ month: `${trigger}SUM(A1)`, enrolled: 1 }]);
      const cell = csv.split("\r\n")[1]?.split(",")[0] ?? "";
      expect(cell.replace(/^"/, "").startsWith("'")).toBe(true);
    },
  );

  test.each(["\n=1+1", " =1+1", "\n\n+cmd", "  @SUM(A1)", "\u00a0-5", "\r\n=1"])(
    "neutralises a text cell with leading whitespace before a trigger: %j",
    (text) => {
      const csv = buildCsv(columns, [{ month: text, enrolled: 1 }]);
      const body = csv.slice(csv.indexOf("\r\n") + 2);
      expect(body.replace(/^"/, "").startsWith("'")).toBe(true);
    },
  );

  test("leaves text with leading whitespace but no trigger untouched", () => {
    const csv = buildCsv(columns, [{ month: " Oct", enrolled: 1 }]);
    expect(csv.endsWith(" Oct,1")).toBe(true);
  });

  test("numeric-looking strings from text columns are neutralised while real numbers stay numbers", () => {
    const csv = buildCsv(columns, [
      { month: "-5", enrolled: -5 },
      { month: "+7", enrolled: 7 },
      { month: "5", enrolled: 5 },
    ]);
    expect(csv.split("\r\n").slice(1)).toEqual(["'-5,-5", "'+7,7", "5,5"]);
  });

  test("keeps the sign of negative and positive numbers", () => {
    const csv = buildCsv(columns, [{ month: "Oct", enrolled: -5 }]);
    expect(csv.endsWith("Oct,-5")).toBe(true);
  });

  test("quotes commas, quotes and line breaks and doubles inner quotes", () => {
    const csv = buildCsv(columns, [
      { month: 'A, "B"', enrolled: 1 },
      { month: "line\nbreak", enrolled: 2 },
    ]);
    expect(csv).toContain('"A, ""B"""');
    expect(csv).toContain('"line\nbreak"');
  });

  test("writes dates in Asia/Dhaka", () => {
    const csv = buildCsv(columns, [{ month: new Date("2026-10-31T19:30:00Z"), enrolled: 1 }]);
    expect(csv).toContain("2026-11-01,1");
  });

  test("writes booleans as text", () => {
    expect(buildCsv([{ key: "ok", label: "Ok" }], [{ ok: true }])).toContain("true");
  });
});

describe("formatDhakaDate", () => {
  test("uses the Dhaka calendar day, not the UTC one", () => {
    expect(formatDhakaDate(new Date("2026-10-31T18:00:00Z"))).toBe("2026-11-01");
    expect(formatDhakaDate(new Date("2026-10-31T17:59:00Z"))).toBe("2026-10-31");
  });
});

describe("csvFileName", () => {
  const date = new Date("2026-11-09T05:00:00Z");

  test("builds a safe name with the Dhaka date", () => {
    expect(csvFileName("Completion by month", date)).toBe("completion-by-month-2026-11-09.csv");
  });

  test("removes path characters and dots", () => {
    expect(csvFileName("../../etc/passwd", date)).toBe("etc-passwd-2026-11-09.csv");
    expect(csvFileName('a\\b:c*d?"e', date)).toBe("a-b-c-d-e-2026-11-09.csv");
  });

  test("falls back to a plain name for an empty title", () => {
    expect(csvFileName("   ", date)).toBe("chart-2026-11-09.csv");
    expect(csvFileName("***", date)).toBe("chart-2026-11-09.csv");
  });

  test("limits the length", () => {
    expect(csvFileName("x".repeat(200), date).length).toBeLessThanOrEqual(80);
  });
});

describe("downloadCsv", () => {
  test("clicks a temporary link with the file name and revokes the object URL", () => {
    const create = vi.fn(() => "blob:test");
    const revoke = vi.fn();
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    downloadCsv("data.csv", "a,b");

    expect(create).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
    expect(revoke).toHaveBeenCalledWith("blob:test");
    expect(document.querySelector("a[download]")).toBeNull();
    click.mockRestore();
  });
});
