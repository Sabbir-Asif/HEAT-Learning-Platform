import { contrastRatio, parseHex } from "./contrast.mjs";

export const THEMES = ["light", "dark"];
export const STATUS_TONES = ["neutral", "info", "success", "warning", "danger", "brand"];
export const STATUS_STATES = [
  "enrollment.pending-verification",
  "enrollment.pending-approval",
  "enrollment.approved",
  "enrollment.completed",
  "enrollment.rejected",
  "enrollment.expired",
  "enrollment.removed",
  "video.uploading",
  "video.uploaded",
  "video.queued",
  "video.processing",
  "video.ready",
  "video.failed",
  "video.rejected",
  "course.draft",
  "course.published",
  "course.locked",
];

const BASE_ROLES = [
  "background",
  "foreground",
  "card",
  "card-foreground",
  "popover",
  "popover-foreground",
  "primary",
  "primary-foreground",
  "secondary",
  "secondary-foreground",
  "muted",
  "muted-foreground",
  "accent",
  "accent-foreground",
  "destructive",
  "destructive-foreground",
  "border",
  "input",
  "ring",
  "divider",
  "link",
  "chart-1",
  "chart-2",
  "chart-3",
  "chart-4",
  "chart-5",
  "sidebar",
  "sidebar-foreground",
  "sidebar-primary",
  "sidebar-primary-foreground",
  "sidebar-accent",
  "sidebar-accent-foreground",
  "sidebar-border",
  "sidebar-ring",
  "disabled",
  "disabled-foreground",
  "player",
  "player-foreground",
];

export const REQUIRED_ROLES = [
  ...BASE_ROLES,
  ...STATUS_TONES.flatMap((tone) => [
    `status-${tone}`,
    `status-${tone}-foreground`,
    `status-${tone}-mark`,
  ]),
];

export const REQUIRED_TYPE_STYLES = [
  "display",
  "heading-1",
  "heading-2",
  "heading-3",
  "body-lg",
  "body",
  "label",
  "small",
];
const REQUIRED_RADIUS = ["sm", "md", "lg", "xl", "full"];
const REQUIRED_SHADOWS = ["sm", "md", "lg"];
const REQUIRED_FONT_KEYS = [
  "family",
  "cssFamily",
  "weights",
  "subsets",
  "source",
  "license",
  "fallbackStack",
];
const PAIR_KINDS = { text: 4.5, "large-text": 3, "non-text": 3 };
const MAX_FONT_WEIGHTS = 3;
const MIN_BODY_SIZE = 16;

const isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
const isNumber = (value) => typeof value === "number" && Number.isFinite(value);

export function roleNames(tokens) {
  return Object.keys(tokens.colors.light);
}

export function requiredPairs(names) {
  const has = (name) => names.includes(name);
  const pairs = [];
  const add = (foreground, backgrounds, kind) => {
    if (!has(foreground)) return;
    for (const background of backgrounds) {
      if (has(background)) pairs.push({ foreground, background, kind });
    }
  };
  for (const name of names) {
    if (!name.endsWith("-foreground") || name.startsWith("disabled")) continue;
    add(name, [name.slice(0, -"-foreground".length)], "text");
  }
  add("foreground", ["background", "card", "popover", "muted", "secondary", "accent"], "text");
  add("muted-foreground", ["background", "card", "muted"], "text");
  for (const role of ["link", "primary", "destructive"]) add(role, ["background", "card"], "text");
  for (const tone of STATUS_TONES) add(`status-${tone}-mark`, ["background", "card"], "text");
  for (const role of ["input", "border", "ring"]) add(role, ["background", "card"], "non-text");
  add("sidebar-ring", ["sidebar"], "non-text");
  add("sidebar-primary", ["sidebar"], "non-text");
  for (const n of [1, 2, 3, 4, 5]) add(`chart-${n}`, ["card"], "non-text");
  return pairs;
}

function checkColours(tokens, failures) {
  const colors = tokens.colors;
  if (!isRecord(colors) || !THEMES.every((theme) => isRecord(colors[theme]))) {
    failures.push("colors must have a light and a dark object");
    return false;
  }
  const [light, dark] = THEMES.map((theme) => Object.keys(colors[theme]));
  for (const name of light.filter((key) => !dark.includes(key))) {
    failures.push(`Role ${name} is in light and missing in dark`);
  }
  for (const name of dark.filter((key) => !light.includes(key))) {
    failures.push(`Role ${name} is in dark and missing in light`);
  }
  for (const theme of THEMES) {
    for (const [name, value] of Object.entries(colors[theme])) {
      try {
        parseHex(value);
      } catch {
        failures.push(
          `Role ${name} in ${theme} is not an opaque hex colour: ${JSON.stringify(value)}`,
        );
      }
    }
  }
  for (const name of REQUIRED_ROLES) {
    if (!light.includes(name) && !dark.includes(name)) failures.push(`Missing role ${name}`);
  }
  return true;
}

function checkPairs(tokens, failures) {
  const names = roleNames(tokens);
  const pairs = tokens.pairs;
  if (!Array.isArray(pairs)) {
    failures.push("pairs must be a list");
    return;
  }
  const label = (pair) => `${pair?.foreground} on ${pair?.background}`;
  for (const pair of pairs) {
    for (const side of ["foreground", "background"]) {
      const role = pair?.[side];
      if (!(role in tokens.colors.light && role in tokens.colors.dark)) {
        failures.push(`Pair ${label(pair)} names ${side} role ${role} that is not in both themes`);
      }
    }
    if (!(pair?.kind in PAIR_KINDS)) {
      failures.push(
        `Pair ${label(pair)} has kind ${JSON.stringify(pair?.kind)}; use text, large-text or non-text`,
      );
    }
    if (pair && "exempt" in pair) {
      if (pair.exempt !== "disabled") {
        failures.push(
          `Pair ${label(pair)} has exempt ${JSON.stringify(pair.exempt)}; only disabled is allowed`,
        );
      } else if (
        !pair.foreground?.startsWith("disabled") &&
        !pair.background?.startsWith("disabled")
      ) {
        failures.push(`Pair ${label(pair)} is exempt as disabled but names no disabled role`);
      }
    }
  }
  const declared = (foreground, background, kind) =>
    pairs.some(
      (pair) =>
        pair?.foreground === foreground &&
        pair?.background === background &&
        (kind === undefined || pair.kind === kind),
    );
  for (const name of names.filter((role) => role.endsWith("-foreground"))) {
    const base = name.slice(0, -"-foreground".length);
    if (!declared(name, base)) failures.push(`${name} has no declared pair on ${base}`);
  }
  for (const { foreground, background, kind } of requiredPairs(names)) {
    if (!declared(foreground, background, kind)) {
      failures.push(`Missing required pair ${foreground} on ${background} as ${kind}`);
    }
  }
}

function checkStatusTones(tokens, failures) {
  const tones = tokens.statusTones;
  if (!isRecord(tones)) {
    failures.push("statusTones must map every StatusBadge state to a tone");
    return;
  }
  for (const state of STATUS_STATES) {
    if (!(state in tones)) failures.push(`Status state ${state} has no tone`);
  }
  for (const [state, tone] of Object.entries(tones)) {
    if (!STATUS_STATES.includes(state)) failures.push(`${state} is not a StatusBadge state`);
    else if (!STATUS_TONES.includes(tone))
      failures.push(`Status state ${state} has unknown tone ${JSON.stringify(tone)}`);
  }
}

function checkType(tokens, failures) {
  const styles = tokens.type?.styles;
  if (!isRecord(styles)) {
    failures.push("type.styles is missing");
    return;
  }
  const weights = Array.isArray(tokens.font?.weights) ? tokens.font.weights : [];
  for (const name of REQUIRED_TYPE_STYLES) {
    if (!(name in styles)) failures.push(`Missing type style ${name}`);
  }
  for (const [name, style] of Object.entries(styles)) {
    const { size, weight, lineHeight } = style ?? {};
    if (!isNumber(size) || !isNumber(lineHeight)) {
      failures.push(`Type style ${name} needs size and lineHeight as numbers`);
      continue;
    }
    if (!weights.includes(weight))
      failures.push(`Type style ${name} uses weight ${weight}, which the font does not declare`);
    if (lineHeight < size) failures.push(`Type style ${name} has a line height below its size`);
  }
  if (isNumber(styles.body?.size) && styles.body.size < MIN_BODY_SIZE) {
    failures.push(`Type style body must be at least ${MIN_BODY_SIZE} px`);
  }
}

function checkScales(tokens, failures) {
  const radius = tokens.radius;
  for (const step of REQUIRED_RADIUS) {
    if (!isNumber(radius?.[step])) failures.push(`radius.${step} is missing or not a number`);
  }
  const { base, scale } = tokens.spacing ?? {};
  if (base !== 4) failures.push("spacing.base must be 4");
  if (!isRecord(scale) || Object.keys(scale).length === 0) {
    failures.push("spacing.scale is missing");
    return;
  }
  for (const [step, value] of Object.entries(scale)) {
    if (!isNumber(value) || value % 4 !== 0)
      failures.push(`spacing ${step} is ${value}, not a multiple of the 4 px base`);
  }
}

function checkShadows(tokens, failures) {
  const shadows = tokens.shadows;
  for (const theme of THEMES) {
    const set = shadows?.[theme];
    if (!isRecord(set)) {
      failures.push(`shadows.${theme} is missing`);
      continue;
    }
    for (const step of REQUIRED_SHADOWS) {
      const layers = set[step];
      if (!Array.isArray(layers) || layers.length === 0) {
        failures.push(`shadow ${theme} ${step} is missing`);
        continue;
      }
      for (const field of ["x", "y", "blur", "spread", "opacity"]) {
        if (layers.some((layer) => !isNumber(layer?.[field])))
          failures.push(`shadow ${theme} ${step} has a layer without ${field}`);
      }
      for (const layer of layers) {
        try {
          parseHex(layer?.color);
        } catch {
          failures.push(`shadow ${theme} ${step} has a layer without a hex colour`);
        }
      }
    }
  }
}

function checkFont(tokens, failures) {
  for (const name of ["font", "fontDisplay"]) {
    const font = tokens[name];
    if (!isRecord(font)) {
      failures.push(`${name} is missing`);
      continue;
    }
    for (const key of REQUIRED_FONT_KEYS) {
      if (!(key in font)) failures.push(`${name}.${key} is missing`);
    }
    if (Array.isArray(font.weights) && font.weights.length > MAX_FONT_WEIGHTS) {
      failures.push(`${name} declares ${font.weights.length} weights; use at most three weights`);
    }
  }
}

export function validateTokens(tokens) {
  if (!isRecord(tokens)) return ["The token file is not an object"];
  const failures = [];
  if (checkColours(tokens, failures)) {
    checkPairs(tokens, failures);
    checkStatusTones(tokens, failures);
  }
  checkType(tokens, failures);
  checkScales(tokens, failures);
  checkShadows(tokens, failures);
  checkFont(tokens, failures);
  return failures;
}

export function contrastRows(tokens) {
  return THEMES.flatMap((theme) =>
    tokens.pairs.map((pair) => {
      const foregroundHex = tokens.colors[theme][pair.foreground];
      const backgroundHex = tokens.colors[theme][pair.background];
      const ratio = contrastRatio(foregroundHex, backgroundHex);
      const required = PAIR_KINDS[pair.kind];
      const status = pair.exempt ? "exempt" : ratio >= required ? "pass" : "fail";
      return {
        theme,
        foreground: pair.foreground,
        background: pair.background,
        foregroundHex,
        backgroundHex,
        kind: pair.kind,
        required,
        ratio,
        status,
      };
    }),
  );
}

export const failingRows = (rows) => rows.filter((row) => row.status === "fail");

const AREAS = ["student", "admin", "specimen", "drawer"];
const WIDTHS = ["phone", "laptop"];
const LANGS = ["en"];
const FRAME_ID = new RegExp(
  `^(${AREAS.join("|")})-([a-z0-9]+(?:-[a-z0-9]+)*)-(${WIDTHS.join("|")})-(${THEMES.join("|")})-(${LANGS.join("|")})$`,
);
const OVERLAY_WORDS = /(^|-)(modal|dialog|popup)(-|$)/;

function checkFrame(frame, failures) {
  const id = frame?.id;
  const parts = typeof id === "string" ? FRAME_ID.exec(id) : null;
  if (!parts) {
    failures.push(
      `Frame id ${JSON.stringify(id)} does not match <area>-<screen>-<width>-<theme>-<lang> in lower case`,
    );
    return;
  }
  const [, area, screen, width, theme, lang] = parts;
  const expected = { area, screen, width, theme, lang };
  for (const [field, value] of Object.entries(expected)) {
    if (frame[field] !== value)
      failures.push(
        `Frame ${id} has ${field} ${JSON.stringify(frame[field])}, but its id says ${value}`,
      );
  }
  if (OVERLAY_WORDS.test(screen))
    failures.push(`Frame ${id} names a modal, dialog or popup; use a drawer`);
  const overlay = frame.overlay;
  if ((overlay !== undefined || area === "drawer") && overlay !== "drawer") {
    failures.push(
      `Frame ${id}: every overlay must be a drawer and carry overlay "drawer", not ${JSON.stringify(overlay)}`,
    );
  }
}

export function checkInventory(inventory, exportFiles) {
  if (!isRecord(inventory)) return ["The inventory is not an object"];
  if (!Array.isArray(inventory.frames)) return ["The inventory needs a frames list"];
  const failures = [];
  const seen = new Set();
  for (const frame of inventory.frames) {
    checkFrame(frame, failures);
    if (seen.has(frame?.id)) failures.push(`Duplicate frame id ${frame.id}`);
    seen.add(frame?.id);
  }
  const exported = new Set(
    exportFiles.filter((file) => file.endsWith(".png")).map((file) => file.slice(0, -4)),
  );
  for (const id of seen) {
    if (!exported.has(id)) failures.push(`Frame ${id} has no export in exports/${id}.png`);
  }
  for (const id of exported) {
    if (!seen.has(id)) failures.push(`Export ${id}.png has no inventory entry`);
  }
  return failures;
}
