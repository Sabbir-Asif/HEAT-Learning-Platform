import { describe, expect, test } from "vitest";
import { evaluateAudit } from "../src/audit.mjs";

const today = new Date("2026-11-07T10:00:00Z");

const advisory = (severity, id = "GHSA-aaaa-bbbb-cccc") => ({
  github_advisory_id: id,
  severity,
  module_name: "left-pad",
  title: "Something bad",
});
const report = (...items) => ({ advisories: Object.fromEntries(items.map((a, i) => [i, a])) });
const ignore = (overrides = {}) => ({
  advisory: "GHSA-aaaa-bbbb-cccc",
  reason: "Dev-only, not reachable",
  expires: "2026-12-01",
  ...overrides,
});

describe("evaluateAudit", () => {
  test("passes when there are no advisories", () => {
    expect(evaluateAudit({}, [], today)).toEqual([]);
  });

  test.each(["info", "low", "moderate"])("lets %s advisories through", (severity) => {
    expect(evaluateAudit(report(advisory(severity)), [], today)).toEqual([]);
  });

  test.each(["high", "critical"])("fails on %s advisories", (severity) => {
    const failures = evaluateAudit(report(advisory(severity)), [], today);
    expect(failures).toEqual([`${severity} GHSA-aaaa-bbbb-cccc: left-pad, Something bad`]);
  });

  test("an active ignore silences its advisory only", () => {
    const other = advisory("high", "GHSA-dddd-eeee-ffff");
    const failures = evaluateAudit(report(advisory("high"), other), [ignore()], today);
    expect(failures).toEqual(["high GHSA-dddd-eeee-ffff: left-pad, Something bad"]);
  });

  test("an ignore on its last day still holds", () => {
    expect(
      evaluateAudit(report(advisory("high")), [ignore({ expires: "2026-11-07" })], today),
    ).toEqual([]);
  });

  test("an expired ignore fails and no longer silences the advisory", () => {
    const failures = evaluateAudit(
      report(advisory("high")),
      [ignore({ expires: "2026-11-06" })],
      today,
    );
    expect(failures).toHaveLength(2);
    expect(failures[0]).toContain("expired on 2026-11-06");
  });

  test.each([
    ["a reason", { reason: " " }, "missing reason"],
    ["an advisory id", { advisory: undefined }, "missing advisory id"],
    ["a valid expiry", { expires: "soon" }, "expires must be a YYYY-MM-DD date"],
    ["a close expiry", { expires: "2027-06-01" }, "more than 90 days out"],
  ])("rejects an ignore without %s", (_name, overrides, message) => {
    const failures = evaluateAudit({}, [ignore(overrides)], today);
    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain(message);
  });
});
