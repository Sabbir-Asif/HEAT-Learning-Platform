import { describe, expect, test } from "vitest";
import {
  STATUS_STATES,
  STATUS_TONES,
  checkInventory,
  contrastRows,
  failingRows,
  requiredPairs,
  roleNames,
  validateTokens,
} from "../src/design-checks.mjs";

const clone = (value) => structuredClone(value);

function themeColours({ ink, paper, mid, sunk, faint }) {
  const colours = {
    background: paper,
    foreground: ink,
    card: paper,
    "card-foreground": ink,
    popover: paper,
    "popover-foreground": ink,
    primary: ink,
    "primary-foreground": paper,
    secondary: sunk,
    "secondary-foreground": ink,
    muted: sunk,
    "muted-foreground": mid,
    accent: sunk,
    "accent-foreground": ink,
    destructive: ink,
    "destructive-foreground": paper,
    border: mid,
    input: mid,
    ring: mid,
    divider: sunk,
    link: mid,
    sidebar: ink,
    "sidebar-foreground": paper,
    "sidebar-primary": paper,
    "sidebar-primary-foreground": ink,
    "sidebar-accent": mid,
    "sidebar-accent-foreground": paper,
    "sidebar-border": mid,
    "sidebar-ring": paper,
    disabled: sunk,
    "disabled-foreground": faint,
    player: ink,
    "player-foreground": paper,
  };
  for (const n of [1, 2, 3, 4, 5]) colours[`chart-${n}`] = mid;
  for (const tone of STATUS_TONES) {
    colours[`status-${tone}`] = sunk;
    colours[`status-${tone}-foreground`] = ink;
    colours[`status-${tone}-mark`] = mid;
  }
  return colours;
}

const light = themeColours({
  ink: "#000000",
  paper: "#ffffff",
  mid: "#595959",
  sunk: "#eeeeee",
  faint: "#aaaaaa",
});
const dark = themeColours({
  ink: "#ffffff",
  paper: "#000000",
  mid: "#bfbfbf",
  sunk: "#1a1a1a",
  faint: "#555555",
});

function validTokens() {
  const names = Object.keys(light);
  const pairs = [
    ...requiredPairs(names),
    { foreground: "disabled-foreground", background: "disabled", kind: "text", exempt: "disabled" },
  ];
  const typeStyle = (size, weight, lineHeight) => ({ size, weight, lineHeight });
  const layer = { x: 0, y: 1, blur: 2, spread: 0, color: "#000000", opacity: 0.1 };
  const shadows = { sm: [layer], md: [layer], lg: [layer] };
  return {
    version: 1,
    colors: { light: { ...light }, dark: { ...dark } },
    statusTones: Object.fromEntries(STATUS_STATES.map((state) => [state, "neutral"])),
    pairs,
    type: {
      styles: {
        display: typeStyle(40, 700, 48),
        "heading-1": typeStyle(32, 700, 40),
        "heading-2": typeStyle(24, 600, 32),
        "heading-3": typeStyle(20, 600, 28),
        "body-lg": typeStyle(18, 400, 28),
        body: typeStyle(16, 400, 24),
        label: typeStyle(14, 600, 20),
        small: typeStyle(14, 400, 20),
      },
    },
    radius: { sm: 4, md: 8, lg: 12, xl: 16, full: 9999 },
    spacing: { base: 4, scale: { 1: 4, 2: 8, 3: 12, 4: 16, 6: 24, 8: 32 } },
    shadows: { light: clone(shadows), dark: clone(shadows) },
    font: {
      family: "Public Sans",
      cssFamily: "Public Sans Variable",
      weights: [400, 600, 700],
      subsets: ["latin"],
      source: "@fontsource-variable/public-sans",
      license: "OFL-1.1",
      fallbackStack: ["system-ui", "sans-serif"],
    },
    fontDisplay: {
      family: "Source Serif 4",
      cssFamily: "Source Serif 4 Variable",
      weights: [600, 700],
      subsets: ["latin"],
      source: "@fontsource-variable/source-serif-4",
      license: "OFL-1.1",
      fallbackStack: ["Georgia", "serif"],
    },
  };
}

const mutated = (change) => {
  const tokens = validTokens();
  change(tokens);
  return tokens;
};

const problems = (tokens) => validateTokens(tokens).join("\n");

describe("validateTokens", () => {
  test("accepts a complete token file", () => {
    expect(validateTokens(validTokens())).toEqual([]);
  });

  test("fails when light and dark define different roles", () => {
    const tokens = mutated((t) => delete t.colors.dark["chart-3"]);
    expect(problems(tokens)).toMatch(/chart-3.*light.*dark|dark.*chart-3/s);
  });

  test("fails on a role that is not an opaque hex", () => {
    const tokens = mutated((t) => (t.colors.light.background = "#ffffff80"));
    expect(problems(tokens)).toMatch(/background.*hex/is);
  });

  test("fails when a shadcn role is missing in both themes", () => {
    const tokens = mutated((t) => {
      delete t.colors.light.ring;
      delete t.colors.dark.ring;
    });
    expect(problems(tokens)).toMatch(/missing role.*ring/i);
  });

  test("fails when a foreground role has no declared pair", () => {
    const tokens = mutated((t) => {
      t.pairs = t.pairs.filter((p) => p.foreground !== "card-foreground");
    });
    expect(problems(tokens)).toMatch(/card-foreground.*no declared pair/i);
  });

  test("fails when a pair names a role that does not exist", () => {
    const tokens = mutated((t) =>
      t.pairs.push({ foreground: "ghost", background: "card", kind: "text" }),
    );
    expect(problems(tokens)).toMatch(/ghost/);
  });

  test("fails when a required pair is missing", () => {
    const tokens = mutated((t) => {
      t.pairs = t.pairs.filter(
        (p) => !(p.foreground === "muted-foreground" && p.background === "card"),
      );
    });
    expect(problems(tokens)).toMatch(/required pair.*muted-foreground.*card/i);
  });

  test("fails when a required text pair is declared as large text", () => {
    const tokens = mutated((t) => {
      const pair = t.pairs.find(
        (p) => p.foreground === "foreground" && p.background === "background",
      );
      pair.kind = "large-text";
    });
    expect(problems(tokens)).toMatch(/required pair.*foreground.*background/i);
  });

  test("fails on a pair kind that is not text, large-text or non-text", () => {
    const tokens = mutated((t) => (t.pairs[0].kind = "decorative"));
    expect(problems(tokens)).toMatch(/kind/i);
  });

  test("fails on an exemption other than disabled", () => {
    const tokens = mutated((t) => {
      t.pairs.find((p) => p.exempt).exempt = "brand";
    });
    expect(problems(tokens)).toMatch(/exempt/i);
  });

  test("fails on a disabled exemption for a pair that is not a disabled role", () => {
    const tokens = mutated((t) => {
      t.pairs.find((p) => p.foreground === "muted-foreground" && p.background === "muted").exempt =
        "disabled";
    });
    expect(problems(tokens)).toMatch(/exempt.*disabled role/i);
  });

  test("fails when a status state has no tone", () => {
    const tokens = mutated((t) => delete t.statusTones["enrollment.removed"]);
    expect(problems(tokens)).toMatch(/enrollment\.removed.*tone/i);
  });

  test("fails when a status state maps to an unknown tone", () => {
    const tokens = mutated((t) => (t.statusTones["video.ready"] = "purple"));
    expect(problems(tokens)).toMatch(/video\.ready.*purple/);
  });

  test("fails on a status state that is not a StatusBadge state", () => {
    const tokens = mutated((t) => (t.statusTones["course.archived"] = "neutral"));
    expect(problems(tokens)).toMatch(/course\.archived/);
  });

  test("fails when a type style uses a weight the font does not declare", () => {
    const tokens = mutated((t) => (t.type.styles.body.weight = 500));
    expect(problems(tokens)).toMatch(/body.*weight/i);
  });

  test("fails on body text under 16 px", () => {
    const tokens = mutated((t) => (t.type.styles.body.size = 15));
    expect(problems(tokens)).toMatch(/body.*16/);
  });

  test("fails when a line height is below its size", () => {
    const tokens = mutated((t) => (t.type.styles["heading-1"].lineHeight = 30));
    expect(problems(tokens)).toMatch(/heading-1.*line height/i);
  });

  test("fails when a required type style is missing", () => {
    const tokens = mutated((t) => delete t.type.styles.label);
    expect(problems(tokens)).toMatch(/type style.*label/i);
  });

  test("fails on a spacing value off the 4 px base", () => {
    const tokens = mutated((t) => (t.spacing.scale[2] = 10));
    expect(problems(tokens)).toMatch(/spacing.*10/i);
  });

  test("fails when a radius step is missing", () => {
    const tokens = mutated((t) => delete t.radius.lg);
    expect(problems(tokens)).toMatch(/radius.*lg/i);
  });

  test("fails when a shadow layer lacks a field", () => {
    const tokens = mutated((t) => delete t.shadows.dark.md[0].blur);
    expect(problems(tokens)).toMatch(/shadow.*dark.*md.*blur/i);
  });

  test("fails when light and dark shadows differ in steps", () => {
    const tokens = mutated((t) => delete t.shadows.dark.lg);
    expect(problems(tokens)).toMatch(/shadow.*lg/i);
  });

  test("fails when the font object lacks a key", () => {
    const tokens = mutated((t) => delete t.font.license);
    expect(problems(tokens)).toMatch(/font.*license/i);
  });

  test("fails when the body font is not Public Sans", () => {
    const tokens = mutated((t) => (t.font.family = "Noto Sans"));
    expect(problems(tokens)).toMatch(/font\.family.*Public Sans/i);
  });

  test("fails when the display font is not Source Serif 4", () => {
    const tokens = mutated((t) => (t.fontDisplay.family = "Noto Serif"));
    expect(problems(tokens)).toMatch(/fontDisplay\.family.*Source Serif 4/i);
  });

  test("fails when the display font lacks a key", () => {
    const tokens = mutated((t) => delete t.fontDisplay.family);
    expect(problems(tokens)).toMatch(/fontDisplay.*family/i);
  });

  test("fails when the font declares more than three weights", () => {
    const tokens = mutated((t) => (t.font.weights = [400, 500, 600, 700]));
    expect(problems(tokens)).toMatch(/three weights/i);
  });

  test("reports a missing section instead of throwing", () => {
    expect(validateTokens({})).not.toEqual([]);
    expect(validateTokens(null)).not.toEqual([]);
  });
});

describe("requiredPairs", () => {
  const names = Object.keys(light);
  const pairs = requiredPairs(names);
  const has = (foreground, background, kind) =>
    pairs.some(
      (p) => p.foreground === foreground && p.background === background && p.kind === kind,
    );

  test("each foreground role is checked on its base", () => {
    expect(has("primary-foreground", "primary", "text")).toBe(true);
    expect(has("sidebar-accent-foreground", "sidebar-accent", "text")).toBe(true);
    expect(has("status-danger-foreground", "status-danger", "text")).toBe(true);
  });

  test("text on the surfaces", () => {
    for (const surface of ["background", "card", "popover", "muted", "secondary", "accent"]) {
      expect(has("foreground", surface, "text")).toBe(true);
    }
    for (const surface of ["background", "card", "muted"]) {
      expect(has("muted-foreground", surface, "text")).toBe(true);
    }
    for (const role of ["link", "primary", "destructive", "status-success-mark"]) {
      expect(has(role, "background", "text")).toBe(true);
      expect(has(role, "card", "text")).toBe(true);
    }
  });

  test("non-text marks", () => {
    for (const role of ["input", "border", "ring"]) {
      expect(has(role, "background", "non-text")).toBe(true);
      expect(has(role, "card", "non-text")).toBe(true);
    }
    expect(has("sidebar-ring", "sidebar", "non-text")).toBe(true);
    expect(has("sidebar-primary", "sidebar", "non-text")).toBe(true);
    for (const n of [1, 2, 3, 4, 5]) expect(has(`chart-${n}`, "card", "non-text")).toBe(true);
  });

  test("disabled roles are never required to pass", () => {
    expect(pairs.some((p) => p.foreground.startsWith("disabled"))).toBe(false);
  });
});

describe("contrastRows", () => {
  test("gives one row per pair and theme", () => {
    const tokens = validTokens();
    expect(contrastRows(tokens)).toHaveLength(tokens.pairs.length * 2);
  });

  test("a fully compliant file has no failing rows", () => {
    expect(failingRows(contrastRows(validTokens()))).toEqual([]);
  });

  test("text pairs need 4.5 and are reported with their ratio", () => {
    const tokens = mutated((t) => (t.colors.light["muted-foreground"] = "#8a8a8a"));
    const failed = failingRows(contrastRows(tokens));
    const row = failed.find((r) => r.foreground === "muted-foreground" && r.background === "card");
    expect(row).toMatchObject({ theme: "light", kind: "text", required: 4.5, status: "fail" });
    expect(row.ratio).toBeLessThan(4.5);
  });

  test("a dark theme failure is reported for the dark theme only", () => {
    const tokens = mutated((t) => (t.colors.dark.ring = "#202020"));
    const themes = failingRows(contrastRows(tokens)).map((r) => r.theme);
    expect(new Set(themes)).toEqual(new Set(["dark"]));
  });

  test("non-text pairs need 3", () => {
    const tokens = mutated((t) => (t.colors.light.input = "#bbbbbb"));
    const row = failingRows(contrastRows(tokens)).find((r) => r.foreground === "input");
    expect(row).toMatchObject({ kind: "non-text", required: 3 });
  });

  test("a declared large-text pair is checked at 3", () => {
    const extra = { foreground: "muted-foreground", background: "muted", kind: "large-text" };
    const tokens = mutated((t) => {
      t.pairs.push(extra);
      t.colors.light["muted-foreground"] = "#6b6b6b";
      t.colors.light.muted = "#ffffff";
    });
    const row = contrastRows(tokens).find(
      (r) => r.kind === "large-text" && r.theme === "light" && r.foreground === "muted-foreground",
    );
    expect(row.required).toBe(3);
    expect(row.status).toBe("pass");
  });

  test("a disabled pair is exempt and never fails", () => {
    const rows = contrastRows(validTokens()).filter((r) => r.foreground === "disabled-foreground");
    expect(rows.map((r) => r.status)).toEqual(["exempt", "exempt"]);
    expect(rows[0].ratio).toBeLessThan(3);
    expect(failingRows(rows)).toEqual([]);
  });
});

describe("roleNames", () => {
  test("lists the roles of the light theme", () => {
    expect(roleNames(validTokens())).toEqual(Object.keys(light));
  });
});

const frame = (overrides = {}) => ({
  id: "student-landing-phone-light-en",
  area: "student",
  screen: "landing",
  width: "phone",
  theme: "light",
  lang: "en",
  ...overrides,
});
const inventoryOf = (...frames) => ({ version: 1, frames });
const checkWith = (frames, files) =>
  checkInventory(inventoryOf(...frames), files ?? frames.map((f) => `${f.id}.png`)).join("\n");

describe("checkInventory", () => {
  test("accepts frames that each have an export", () => {
    expect(checkInventory(inventoryOf(frame()), ["student-landing-phone-light-en.png"])).toEqual(
      [],
    );
  });

  test("accepts an empty inventory with no exports", () => {
    expect(checkInventory(inventoryOf(), [])).toEqual([]);
  });

  test("fails when an export is missing", () => {
    expect(checkInventory(inventoryOf(frame()), []).join()).toMatch(
      /student-landing-phone-light-en.*no export/i,
    );
  });

  test("fails when an export has no inventory entry", () => {
    expect(checkInventory(inventoryOf(), ["admin-students-laptop-dark-en.png"]).join()).toMatch(
      /admin-students-laptop-dark-en.*no inventory entry/i,
    );
  });

  test("ignores files that are not PNG exports", () => {
    expect(checkInventory(inventoryOf(), [".gitkeep", "notes.txt"])).toEqual([]);
  });

  test.each([
    ["student-landing-phone-en", "too few parts"],
    ["Student-landing-phone-light-en", "capital letters"],
    ["student_landing_phone_light_en", "underscores"],
    ["student-landing-tablet-light-en", "unknown width"],
    ["student-landing-phone-sepia-bn", "unknown theme"],
    ["student-landing-phone-light-fr", "unknown language"],
    ["student-landing-phone-dark-en", "dark frames are not drawn"],
  ])("fails on the id %s (%s)", (id) => {
    expect(checkWith([frame({ id })])).toMatch(new RegExp(id));
  });

  test("fails when the id parts disagree with the fields", () => {
    expect(checkWith([frame({ theme: "dark" })])).toMatch(/theme/i);
    expect(checkWith([frame({ width: "laptop" })])).toMatch(/width/i);
    expect(checkWith([frame({ lang: "fr" })])).toMatch(/lang/i);
    expect(checkWith([frame({ screen: "dashboard" })])).toMatch(/screen/i);
  });

  test("fails on an unknown area", () => {
    const id = "teacher-landing-phone-light-en";
    expect(checkWith([frame({ id, area: "teacher" })])).toMatch(/area/i);
  });

  test("fails on a duplicate id", () => {
    expect(checkWith([frame(), frame()], ["student-landing-phone-light-en.png"])).toMatch(
      /duplicate/i,
    );
  });

  test("an overlay must be a drawer", () => {
    const id = "drawer-reject-reason-phone-light-en";
    const drawer = frame({ id, area: "drawer", screen: "reject-reason", lang: "en" });
    expect(checkWith([{ ...drawer, overlay: "drawer" }])).toBe("");
    expect(checkWith([{ ...drawer, overlay: "dialog" }])).toMatch(/overlay.*drawer/i);
    expect(checkWith([{ ...drawer, overlay: "modal" }])).toMatch(/overlay.*drawer/i);
  });

  test("a drawer frame must say it is an overlay", () => {
    const id = "drawer-reject-reason-phone-light-en";
    const drawer = frame({ id, area: "drawer", screen: "reject-reason", lang: "en" });
    expect(checkWith([drawer])).toMatch(/overlay.*drawer/i);
  });

  test("an id that names a modal or dialog fails", () => {
    const id = "student-confirm-dialog-phone-light-en";
    expect(checkWith([frame({ id, screen: "confirm-dialog" })])).toMatch(/modal|dialog/i);
    const popup = "admin-popup-laptop-light-en";
    expect(
      checkWith([
        frame({ id: popup, area: "admin", screen: "popup", width: "laptop", lang: "en" }),
      ]),
    ).toMatch(/modal|dialog|popup/i);
  });

  test("fails when frames is not a list", () => {
    expect(checkInventory({ version: 1 }, []).join()).toMatch(/frames/i);
    expect(checkInventory(null, []).join()).toMatch(/inventory/i);
  });
});
