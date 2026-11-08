import { describe, expect, test } from "vitest";
import { checkParity } from "../src/parity";

const en = {
  common: { nav: { home: "Home", greet: "Hello {name}" } },
  site: { title: "Title" },
};

describe("checkParity", () => {
  test("reports nothing for matching catalogs", () => {
    const bn = {
      common: { nav: { home: "হোম", greet: "হ্যালো {name}" } },
      site: { title: "শিরোনাম" },
    };
    expect(checkParity(en, bn)).toEqual({ missing: [], extra: [], empty: [], placeholders: [] });
  });

  test("names a key missing from bn and a key only in bn", () => {
    const bn = {
      common: { nav: { greet: "হ্যালো {name}" } },
      site: { title: "শিরোনাম", extra: "x" },
    };
    expect(checkParity(en, bn)).toMatchObject({
      missing: ["common.nav.home"],
      extra: ["site.extra"],
    });
  });

  test("names empty and blank values in either language", () => {
    const bn = { common: { nav: { home: "  ", greet: "হ্যালো {name}" } }, site: { title: "" } };
    const blankEn = {
      ...en,
      site: { title: "Title" },
      common: { nav: { home: "", greet: "Hello {name}" } },
    };
    expect(checkParity(en, bn).empty).toEqual(["bn: common.nav.home", "bn: site.title"]);
    expect(checkParity(blankEn, bn).empty).toEqual([
      "en: common.nav.home",
      "bn: common.nav.home",
      "bn: site.title",
    ]);
  });

  test("names a key whose placeholder names differ", () => {
    const bn = {
      common: { nav: { home: "হোম", greet: "হ্যালো {nam}" } },
      site: { title: "শিরোনাম" },
    };
    expect(checkParity(en, bn).placeholders).toEqual(["common.nav.greet: en {name}, bn {nam}"]);
  });

  test("a placeholder dropped from bn is reported", () => {
    const bn = { common: { nav: { home: "হোম", greet: "হ্যালো" } }, site: { title: "শিরোনাম" } };
    expect(checkParity(en, bn).placeholders).toEqual(["common.nav.greet: en {name}, bn none"]);
  });
});
