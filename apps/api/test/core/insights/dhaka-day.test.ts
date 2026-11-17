import { describe, expect, test } from "vitest";
import {
  addDays,
  dayAsDate,
  dayFromDate,
  dayOf,
  dayWindow,
  eachDay,
  isDay,
  isNightlyDue,
  recentDays,
} from "../../../src/core/insights";

describe("Asia/Dhaka day bucketing", () => {
  test("an event at 17:59 UTC is still the same Dhaka day", () => {
    expect(dayOf(new Date("2026-11-12T17:59:59.999Z"))).toBe("2026-11-12");
  });

  test("an event at 18:00 UTC belongs to the next Dhaka day", () => {
    expect(dayOf(new Date("2026-11-12T18:00:00.000Z"))).toBe("2026-11-13");
  });

  test("an event just after UTC midnight is still the previous Dhaka day's evening", () => {
    expect(dayOf(new Date("2026-11-13T00:00:00.000Z"))).toBe("2026-11-13");
    expect(dayOf(new Date("2026-11-12T23:30:00.000Z"))).toBe("2026-11-13");
  });

  test("the window of a day runs from 18:00 UTC to 18:00 UTC", () => {
    const window = dayWindow("2026-11-13");
    expect(window.start.toISOString()).toBe("2026-11-12T18:00:00.000Z");
    expect(window.end.toISOString()).toBe("2026-11-13T18:00:00.000Z");
  });

  test("the window start and the instant before it fall on different days", () => {
    const { start } = dayWindow("2026-11-13");
    expect(dayOf(start)).toBe("2026-11-13");
    expect(dayOf(new Date(start.getTime() - 1))).toBe("2026-11-12");
  });

  test("day arithmetic crosses month and year ends", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(eachDay("2026-11-29", "2026-12-02")).toEqual([
      "2026-11-29",
      "2026-11-30",
      "2026-12-01",
      "2026-12-02",
    ]);
    expect(eachDay("2026-11-02", "2026-11-01")).toEqual([]);
  });

  test("database dates round trip", () => {
    expect(dayFromDate(dayAsDate("2026-11-13"))).toBe("2026-11-13");
  });

  test("validates calendar days", () => {
    expect(isDay("2026-02-28")).toBe(true);
    expect(isDay("2026-02-30")).toBe(false);
    expect(isDay("12/11/2026")).toBe(false);
  });
});

describe("nightly schedule", () => {
  test("is not due before 02:00 Dhaka time", () => {
    expect(isNightlyDue(new Date("2026-11-12T19:59:00.000Z"), false)).toBe(false);
  });

  test("is due from 02:00 Dhaka time when it has not started today", () => {
    expect(isNightlyDue(new Date("2026-11-12T20:00:00.000Z"), false)).toBe(true);
  });

  test("is not due again once it started today", () => {
    expect(isNightlyDue(new Date("2026-11-13T05:00:00.000Z"), true)).toBe(false);
  });

  test("rebuilds yesterday and today in Dhaka time", () => {
    expect(recentDays(new Date("2026-11-12T20:00:00.000Z"))).toEqual({
      from: "2026-11-12",
      to: "2026-11-13",
    });
  });
});
