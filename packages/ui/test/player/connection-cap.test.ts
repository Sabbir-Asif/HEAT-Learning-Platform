import { describe, expect, test } from "vitest";
import { selectAutoResolutionCap } from "../../src/player/connection-cap";

describe("selectAutoResolutionCap", () => {
  test("caps at 480p when save data is on", () => {
    expect(selectAutoResolutionCap({ saveData: true, effectiveType: "4g" })).toBe("480p");
  });

  test.each(["slow-2g", "2g", "3g"])("caps at 480p on %s", (effectiveType) => {
    expect(selectAutoResolutionCap({ saveData: false, effectiveType })).toBe("480p");
  });

  test("caps at 720p on 4g", () => {
    expect(selectAutoResolutionCap({ saveData: false, effectiveType: "4g" })).toBe("720p");
  });

  test("caps at 720p when the connection is unknown", () => {
    expect(selectAutoResolutionCap(null)).toBe("720p");
    expect(selectAutoResolutionCap(undefined)).toBe("720p");
    expect(selectAutoResolutionCap({})).toBe("720p");
  });
});
