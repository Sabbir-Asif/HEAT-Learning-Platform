# Design and brand

The design file, the theme and the logo pipeline.

## Design file and theme

The Open Pencil designs, the theme and the screen inventory live in `docs/design/` (see its README). Two checks run over them, and `packages/config/test/design-files.test.mjs` runs both in `pnpm test`:

```sh
pnpm design:contrast   # every colour pair in light and dark with its WCAG 2 ratio; exits 1 on any failure
pnpm design:check      # token structure, contrast, inventory against exports, drawer-only overlays
```

`packages/ui/src/styles.css` is the Tailwind theme built from `docs/design/tokens.json`. Change both together: `packages/ui/test/tokens.test.ts` fails when a value drifts, and `contrast.test.ts` checks every contrast pair in both themes. Each app has one CSS entry, `src/app/globals.css`, that imports `@heat/ui/styles.css` and scans `packages/ui/src`. The theme follows the device setting through `ThemeProvider` (next-themes, `dark` class on `<html>`); a visible switch comes with the shells. The inline script next-themes adds, and the style element it injects on each theme change (`disableTransitionOnChange`), are covered by the CSP of ADR 0019 (hashes on cached pages, a nonce on dynamic pages), so `ThemeProvider` needs no change. Storybook shows every token in light and dark on Foundations, Tokens.

## Brand assets

The logos are static SVG files served at `/brand/<name>.svg` by both frontends. One source of truth feeds both apps: `packages/config/brand/source/*.svg` is run through SVGO (`packages/config/svgo.config.mjs`) and written byte for byte into `apps/frontend-public/public/brand/` and `apps/frontend-internal/public/brand/`. Both copies are committed, so `public/` stays static.

```sh
pnpm brand            # sanitise, optimise and write both copies; a second run changes nothing
pnpm brand --check    # exit 1 and name any missing, stray or hand-edited file
```

To replace a mark, drop the new vector into `packages/config/brand/source/` under the same name, run `pnpm brand` and commit the source and both copies. Do not edit the copies by hand. `<name>-dark.svg` is used on the dark theme and exists only where the plain file fails the legibility check. Choosing the file by theme belongs to the shells.

`packages/config/test/brand.test.mjs` and `brand-assets.test.mjs` enforce the rules:

- Sanitiser: strict XML parse plus an allow-list (`svg g path rect circle ellipse line polyline polygon defs linearGradient radialGradient stop clipPath mask use`). Every attribute has an exact grammar: `fill` and `stroke` take a colour (keyword, `#hex`, `rgb`, `rgba`, `hsl`, `hsla`) or `url(#id)`; `clip-path` and `mask` take `none` or `url(#id)`; `transform` and `gradientTransform` take only transform functions; `href` is a `#fragment`; `d` holds path commands and numbers; every other attribute is letters, digits, spaces and `. , % + - #`. A backslash anywhere in a value fails (CSS escapes such as `u\72l(` cannot hide a URL), so does any other `(`, a repeated attribute, a `<script>`, `<foreignObject>`, `<style>`, `<image>`, `<text>`, an `on*` or `style` attribute, `data:`, `http:`, `https:` or `//`, `<!DOCTYPE`, `<!ENTITY` or a processing instruction, and the message names it. A `viewBox` is required. Text and `<style>` classes must be converted to outlines and presentation attributes. At most 16 `<use>` elements and 16 levels of nesting, so a chain of references cannot multiply into a render bomb. Sources may be up to 128 KB; shipped files are capped at 20 KB.
- Every `.svg` under `apps/*/public/` passes the sanitiser, not only `public/brand/`. `pnpm brand` refuses a symbolic link or a directory named `*.svg` in a target and deletes only stray regular `.svg` files; `--check` reports any other stray file.
- Optimisation: each shipped file is strictly smaller than its source, differs from it in at most 0.2% of pixels (channel difference over 8, both rendered at 512 px with `@resvg/resvg-js`) and is unchanged by a second run.
- Legibility: each file is rendered 40 px high at 1x and 2x over the `--background` of its theme, read from `packages/ui/src/styles.css`. A pixel with at least half opacity is painted and is judged by its own colour, not its anti-aliased blend. At least 1% of the canvas must be painted and at most 10% of the painted pixels may have contrast under 2:1 (3:1 for the `du-crest` placeholder, which is ours). On the light theme a pale pixel (under 1.5:1) counts as blank paper only when ink encloses it, found by flood fill from the transparent outside; pale pixels connected to the outside count as low contrast, so a pale wordmark beside a dark shape fails. WCAG exempts logotypes from the text contrast rule, so 2:1 is an interim bar for the partner marks, not a claim of 3:1: the HEAT bars measure 2.78 to 3.15:1 on the dark background and the GoB seal's orange map is about 2.3:1 on white. The owner may tighten it once the original vectors arrive. The check says nothing about whether the small tagline or the fine print in the seal can be read at 40 px; they cannot, which is why the names live in the alt texts. If `--background` moves out of hex (#31), update `readThemeBackgrounds` with it.

| File                  | Organisation                                           | Source                                                                                                                                          | Status      | Date       |
| --------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ---------- |
| `heat.svg`            | HEAT, Higher Education Acceleration and Transformation | `logo.svg` on heat.ugc.gov.bd, 1000 px PNG, sha256 `36d1925b0ca4e0006c7c0ece9eba6e1797d81fc67939a06a702e9ec7ed89871e`, traced to vectors        | traced      | 2026-11-08 |
| `heat-dark.svg`       | HEAT                                                   | `heat.svg` with near-black and navy fills recoloured to `#e5e7eb`                                                                               | traced      | 2026-11-08 |
| `gob.svg`             | Government of the People's Republic of Bangladesh      | `right-logo1.svg` on heat.ugc.gov.bd, 1000 px PNG, sha256 `b60133e7abd0cac1063844aa75f6b54c16f243bfe425a40129728685c72b0075`, traced to vectors | traced      | 2026-11-08 |
| `ugc.svg`             | University Grants Commission                           | `right-logo2.svg` on heat.ugc.gov.bd, 1000 px PNG, sha256 `dea8b7970ae3d029398608b13144fa700a7c4c763bd5d469ae780db3dfa27ce4`, traced to vectors | traced      | 2026-11-08 |
| `ugc-dark.svg`        | University Grants Commission                           | `ugc.svg` with near-black and navy fills recoloured to `#e5e7eb`                                                                                | traced      | 2026-11-08 |
| `world-bank.svg`      | The World Bank                                         | `right-logo3.svg` on heat.ugc.gov.bd, 500 px PNG, sha256 `feb950613bdf58e1520488b9cab3d3c483e340714594e53d904df00834c7e5e8`, traced to vectors  | traced      | 2026-11-08 |
| `world-bank-dark.svg` | The World Bank                                         | `world-bank.svg` with near-black and navy fills recoloured to `#e5e7eb`                                                                         | traced      | 2026-11-08 |
| `du-crest.svg`        | University of Dhaka                                    | Generic shield, shapes only; no usable source for the crest exists yet                                                                          | placeholder | 2026-11-08 |
| `du-crest-dark.svg`   | University of Dhaka                                    | `du-crest.svg` with a lighter blue, so the placeholder reaches 3:1 on the dark theme                                                            | placeholder | 2026-11-08 |

The files on heat.ugc.gov.bd (downloaded 2026-11-08) are SVG in name only: each wraps one embedded PNG in an `<image>` with a `data:` URI, which the sanitiser rejects. The sha256 sums in the table are of the decoded PNGs. The PNGs were decoded and traced once, outside the repository, with `vtracer` 0.6.15 (Python binding, Pillow 13.0.0 for preparation); the tool is not a dependency. Preparation: alpha cut at 128, cropped to the painted area, colours reduced with Pillow's median cut and no dithering (`heat` 6 colours, `gob` 8, `ugc` 6, `world-bank` 8). Tracing: colour mode, `hierarchical="stacked"`, `mode="spline"`, `color_precision=8`, `layer_difference=24`, `path_precision=0`, `corner_threshold=60`, `length_threshold=8`, `splice_threshold=60`, `filter_speckle=10` (20 for `ugc`). The `-dark` files change only fill colours, by script. No mark was redrawn by hand. The HEAT mark, the text in the seal and the UGC mark are image art, so their names live in the alt texts where each logo is used.

The GoB seal, the UGC mark and the World Bank mark are third-party marks. These traced files are interim: the owner's original vectors replace these files before launch, and the usage terms of each mark stay with its owner. `du-crest.svg` is a placeholder and not the University of Dhaka crest.
