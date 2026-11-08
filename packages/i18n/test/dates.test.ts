import { afterEach, describe, expect, test } from "vitest";
import { formatDate, formatDateTime, formatTime } from "../src/dates";

const instant = new Date("2026-11-07T20:30:00Z");
const zones = ["UTC", "America/New_York", "Asia/Dhaka", "Pacific/Kiritimati"];
const original = process.env["TZ"];

afterEach(() => {
  if (original === undefined) delete process.env["TZ"];
  else process.env["TZ"] = original;
});

function inZone(zone: string) {
  process.env["TZ"] = zone;
}

describe.each(zones)("with the process time zone %s", (zone) => {
  test("the zone switch took effect", () => {
    inZone(zone);
    const expectedOffsets: Record<string, number> = {
      UTC: 20,
      "America/New_York": 15,
      "Asia/Dhaka": 2,
      "Pacific/Kiritimati": 10,
    };
    expect(instant.getHours()).toBe(expectedOffsets[zone]);
  });

  test("formats 2026-11-07T20:30:00Z as 8 November 2026, 02:30 in English", () => {
    inZone(zone);
    expect(formatDateTime(instant, "en")).toBe("8 November 2026, 02:30");
    expect(formatDate(instant, "en")).toBe("8 November 2026");
    expect(formatTime(instant, "en")).toBe("02:30");
  });

  test("formats the same instant with Bangla month names and Bengali digits", () => {
    inZone(zone);
    expect(formatDateTime(instant, "bn")).toBe("৮ নভেম্বর ২০২৬, ০২:৩০");
    expect(formatDate(instant, "bn")).toBe("৮ নভেম্বর ২০২৬");
    expect(formatTime(instant, "bn")).toBe("০২:৩০");
  });
});

describe("inputs", () => {
  test("accepts a Date, an ISO string and epoch milliseconds", () => {
    expect(formatDateTime("2026-11-07T20:30:00Z", "en")).toBe("8 November 2026, 02:30");
    expect(formatDateTime(instant.getTime(), "en")).toBe("8 November 2026, 02:30");
    expect(formatDateTime(instant, "en")).toBe("8 November 2026, 02:30");
  });

  test("the Dhaka day starts six hours ahead of UTC", () => {
    expect(formatDateTime(new Date("2026-11-07T18:00:00Z"), "en")).toBe("8 November 2026, 00:00");
    expect(formatDateTime(new Date("2026-11-07T17:59:00Z"), "en")).toBe("7 November 2026, 23:59");
    expect(formatDateTime(new Date("2026-11-07T18:00:00Z"), "bn")).toBe("৮ নভেম্বর ২০২৬, ০০:০০");
  });

  test("English output holds only ASCII digits and Bangla output no ASCII digit", () => {
    expect(formatDateTime(instant, "en")).not.toMatch(/[০-৯]/);
    expect(formatDateTime(instant, "bn")).not.toMatch(/[0-9]/);
  });

  test.each(zones)("with the process time zone %s a string needs an explicit offset", (zone) => {
    inZone(zone);
    for (const text of [
      "2026-11-07T20:30:00",
      "2026-11-07T20:30",
      "2026-11-07",
      "2026-11-07 20:30:00",
      "2026-11-07T20:30:00 ",
      "Nov 7 2026 20:30",
      "Sat, 07 Nov 2026 20:30:00",
      "2026-11-07T20:30:00+6",
      "2026-11-07T20:30:00z",
    ]) {
      expect(() => formatDateTime(text, "en"), text).toThrow(RangeError);
      expect(() => formatDate(text, "bn"), text).toThrow(RangeError);
      expect(() => formatTime(text, "en"), text).toThrow(RangeError);
    }
  });

  test.each(zones)("with the process time zone %s offsets and Z are honoured", (zone) => {
    inZone(zone);
    for (const text of [
      "2026-11-07T20:30:00Z",
      "2026-11-07T20:30Z",
      "2026-11-07T20:30:00.123Z",
      "2026-11-08T02:30:00+06:00",
      "2026-11-08T02:30:00+0600",
      "2026-11-07T15:30:00-05:00",
      "2026-11-07T15:30:00.000000000-05:00",
    ]) {
      expect(formatDateTime(text, "en"), text).toBe("8 November 2026, 02:30");
    }
  });

  test.each([
    ["an invalid Date", new Date(Number.NaN)],
    ["unparseable text", "not a date"],
    ["an empty string", ""],
    ["NaN", Number.NaN],
    ["infinity", Number.POSITIVE_INFINITY],
  ])("throws RangeError for %s", (_name, value) => {
    for (const format of [formatDate, formatDateTime, formatTime]) {
      expect(() => format(value, "en")).toThrow(RangeError);
      expect(() => format(value, "bn")).toThrow(RangeError);
    }
  });
});
