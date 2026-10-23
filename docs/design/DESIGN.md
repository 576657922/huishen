# 回神 · Design system (DESIGN.md)

**Binding specification.** Version 1.1 · 2026-10-23 · lead product design. Revised after an independent senior review; §15 records every decision and every disagreement.
Covers every route in PRODUCT.md §1, phone first (390 × 844), tablet and desktop (1440 × 900), light and dark.

---

## 0. How to read this document

- **Precedence.** PRODUCT.md decides *what* the product does and says. `src/content/*` holds every string a person reads: a string there beats any string quoted in this document or shown in a mock-up, and safety strings are never re-ordered, merged or paraphrased. This document decides *how it looks and behaves*.
- **Mock-ups are evidence, not authority.** The PNGs and HTML files in `docs/design/final/` (§14.1) are renderings of this text, rebuilt by `src/build.mjs` from the current `tokens.css`, `components.css`, `icons.svg` and `src/content`, and audited (§14.4). Where a mock-up and this text disagree, the mock-up is the defect: report it and implement the text. The build refuses to finish while any PNG is older than the files it was made from, so a stale screenshot cannot be handed over.
- **Implement literally.** Every size, colour, radius, duration and string here is a requirement. Do not round, substitute or "improve". A screen that needs something this document does not define is a design question: use the closest recipe in §13, flag it in your report, and do not invent a new style.
- **Reference CSS.** `docs/design/final/tokens.css` (tokens, fonts, base styles) and `docs/design/final/components.css` (every component in §8, built only from tokens) are the reference implementation. The section numbers in those files point here; their block names match the component names in §12. The page-level `<style>` blocks in `src/pages/*.html` only lay out the mock-ups and are not part of the system.
- **Words used below.** *Ink* = `--ink`. *Rule* = a 1 px line in `--ink`. *Hairline* = `--hair` (0.5 px on 2× screens, 1 px otherwise) in `--rule`. *Line* = 1 px in `--line` (control boundaries). *Phone* < 768 px wide, *tablet* 768–1023, *desktop* ≥ 1024 (§5.2). *Column* = the content width between the side margins.

---

## 1. Principles

The direction is **书页** — the app is set like a well-made printed page: warm paper, ink, one cinnabar seal, a serif for titles, hairline rules, strong left alignment, tabular figures. It should feel edited by a person, not generated.

1. **墨是正文，朱是印。** Ink sets everything that is printed — text, rules, curves, data, buttons. Cinnabar (`--zhu`) is a seal: it marks only *now / here / today* (§3.4).
2. **Rules, not boxes.** Structure comes from alignment, a 1 px ink rule that opens each section, and hairlines between rows. There are no cards, no tiles and no shadows in the page flow.
3. **A strong left edge.** Text, figures and controls align to the left margin. Nothing in a page is centred except the labels inside the 回神 key and the count pad (instruments you hit, §8.15) and the player stage on desktop (§5.5).
4. **Type carries the hierarchy.** Size, weight and the serif/sans contrast do the work; colour only steps ink → ink-2 → ink-3. One screen uses at most six type sizes.
5. **Data like a journal.** Real numbers in tabular Inter, units smaller and lighter, honest axes, no decoration, no legend when there is one series.
6. **Every element earns its place.** No illustration, no decorative icon, no empty encouragement. Every sentence is specific (PRODUCT.md §11).
7. **Calm motion.** The breath curve (and the box pacer) are the only continuous animations in the product. Everything else moves only to show a change of state, in ≤ 320 ms, and never bounces.
8. **Honest by construction.** An evidence grade sits next to every claimed effect. Missed days are never marked. No streaks, badges, scores or progress rings; a number that goes up is never celebrated.

### 1.1 Anti-AI-look rules (review blockers)

The user's hard requirement is 「UI 必须显得专业，不是 AI 做出来的」. A screen that breaks one of these rules is not done.

| Never | Instead |
| --- | --- |
| Cards: rounded (≥ 8 px) boxes with shadows or tinted grounds to group content | Rows on the paper; a 1 px ink rule over each section head; hairlines between rows |
| A grid of equal "feature tiles" (icon on top, title, one line of text) | A list of rows: the practice's own breath glyph, name, one line, value on the right |
| Gradients, glows, glass and blur, neon, coloured washes behind headings | Flat `--paper`; `--paper-sunk` only for tracks, wells and the selected rail item |
| Calm-app palettes (purple, teal, sky blue), a second accent, coloured pills or tags | Ink and paper; at most one cinnabar mark per figure |
| Centred hero text, oversized welcome headlines, stock zen imagery (lotus, pebbles, sunsets, waves, silhouettes) | A dated masthead, a left-aligned title, the practice's breath glyph or its real structure as a figure |
| Emoji, exclamation marks, 「太棒了」「继续保持」, streak flames, confetti, badges, levels | A plain statement of what happened: 「练了 10 分钟」 |
| Progress rings, gauges, scores, mood faces, star ratings | Dots, ticks, step charts, readouts with units |
| Mixed icon sets, filled and outline icons side by side, an icon before every heading | The 回神 sprite only (§9); icons only where they name an action or an object |
| Pill buttons, gradient buttons, floating action buttons | 4 px corners, an ink fill or a 1 px outline, a start bar docked to the bottom |
| Skeleton shimmer, spinners, springs, parallax, carousels, auto-play | Content is local and appears at once; state changes in 100–320 ms |
| Lorem ipsum, invented statistics, generic placeholder copy | Real copy from `src/content/*`, real numbers from the engine and the data layer |
| A raised white pill with a drop shadow as the selected option (the stock segmented control) | An ink-filled cell in an outlined group (§8.8); filters as a typographic row with a 2 px ink rule under the current option |
| A boxed survey scale squeezed onto one line | Two rows of ≥ 44 px cells on one 58 px pitch (§8.16) |
| Icons that borrow another meaning: a square-in-square for home (it reads as ■ stop and copies the seal), a bar chart for records, two sliders for settings | Icons drawn for what they name (§9): a sunrise for 今日, a dot calendar for 记录, a gear for 设置; 回 only in the seal, □ only for 结束 |
| A grey area fill under a line on a reading page | The 2 px line alone; a fill only where it encodes something (the past, in a player) |
| Keyboard instructions on a touch screen, 「轻点屏幕」 under a mouse | Copy that names the input the person has (§10.2) |
| Bold, large or coloured numbers to make data look important | Inter light for large figures, regular in text; units in caption size, ink-2 |
| Browser-default focus glow, blue links, red errors, green success | A 2 px ink focus ring; links in ink with a `--line` underline; errors in ink with an info icon (§3.5) |
| Three-line clamps with "…" on reading content | Full text that wraps; only table cells truncate, with the full text one tap away |

### 1.2 Craft checklist (every screen, before review)

- Six type sizes or fewer (the mock-up build prints them for each screenshot).
- Left edges line up: 20 px margin on phone; the 48 px glyph column plus 16 px gap puts all row text on one second edge (x = 84 at 390 px).
- Figures that tick or align are tabular; a quantity never ends a line apart from its unit (§4.4).
- Hairlines are `--hair` (0.5 px at 2×), never 1 px grey borders on phone.
- A paragraph, caption, hint or row that wraps ends on at least four characters, punctuation included (§4.3).
- Every interactive element has a hit area ≥ 44 × 44 px and a visible focus ring in light and dark (states.png).
- A page without a tab bar carries its own route to help: a `/help` link or the 不舒服 control (PRODUCT.md §10, §8.17).
- Copy is taken verbatim from `src/content` and passes PRODUCT.md §10 (forbidden words) and §11 (style).
- Checked in dark mode (players are always dark) and, for sheets, at 200 % text.
- The mock-up is rebuilt and its audit is clean (§14.4).

---

## 2. Files and sources of truth

| File (in `docs/design/final/`) | What it is | Engineering use |
| --- | --- | --- |
| `tokens.css` | Colour, type, space, layout, radius, motion and layer tokens; `@font-face`; base element styles (including `scroll-padding` and the input-modality rule); type-role and utility classes | Split into `src/ui/tokens.css` (everything above "Base element styles") and `src/ui/base.css` (the rest), both unchanged; import once in `main.tsx` |
| `components.css` | Reference CSS for every component in §8, from tokens only, with its responsive rules (rail, dialogs, player layouts) | Port block by block into `src/ui/components/<Name>/<Name>.module.css` (§12) |
| `icons.svg` | The icon sprite: 51 symbols (§9) | Copy to `public/icons.svg`; `<Icon name>` renders `<svg><use href="/icons.svg#i-name"/></svg>` |
| `logo.svg`, `mark.svg` | Lockup (seal + 回神) and the seal alone | The in-app lockup is the seal path plus live text (§8.0) |
| `app-icon.svg`, `favicon.svg` | PWA icon (maskable: paper ground, seal at 50 % inside the central 80 %) and favicon | `npm run icons` (`scripts/build-icons.mjs`) |
| `*.html`, `*.png` | Renderings of this document (§14.1), rebuilt from the current CSS, icons and content and audited; `states.png` is the keyboard-state board | Visual reference only — this text wins (§0) |
| `src/build.mjs`, `shoot.mjs`, `content.mjs`, `draw.mjs`, `charts.mjs`, `data.mjs`, `pages/` | The mock-up build: page templates, figure geometry, the one dataset all screens share, the content loader (`content.mjs` imports `src/content/*.ts` directly) and the audit | `draw.mjs` and `charts.mjs` are the geometric spec for every figure (§12.4); `content.mjs` lists, under `NEW`, every string content does not have yet (§14.3) |

Font sources live in `node_modules/.cache/huishen-fonts/` (§4.1).

---

## 3. Colour

All values are WCAG 2.x contrast ratios, measured 2026-10-23 against the three grounds.

### 3.1 Light · 纸 (default)

| Token | Value | Role | on `--paper` | on `--paper-sunk` | on `--paper-raised` |
| --- | --- | --- | --- | --- | --- |
| `--paper` | `#F4F1EA` | page ground; PWA `background_color` and `theme_color` | — | — | — |
| `--paper-sunk` | `#EAE6DD` | the off toggle, the selected rail item, disabled button fill | — | — | — |
| `--paper-raised` | `#FBFAF7` | sheets, dialogs, thumbs and knobs, text fields, the 回神 key and count-pad keys | — | — | — |
| `--ink` | `#1B1916` | text, rules, fills, data marks, focus ring | 15.55 | 14.08 | 16.80 |
| `--ink-2` | `#4E4943` | secondary text, values, bars | 7.90 | 7.15 | 8.53 |
| `--ink-3` | `#6B645A` | meta, captions, hints, axis text, placeholders | 5.18 | 4.69 | 5.60 |
| `--line` | `#857E72` | control boundaries (WCAG 1.4.11), slider track, marks that are still ahead | 3.56 | 3.23 | 3.85 |
| `--rule` | `#DCD6CB` | hairlines between rows — decorative, never the only boundary of a control | 1.28 | 1.16 | 1.39 |
| `--zhu` | `#B33A21` | cinnabar mark only (§3.4) | 5.25 | 4.76 | 5.68 |
| `--on-ink` | `#F4F1EA` | text and icons on ink fills | 15.55 on `--ink` · 11.48 on `--ink-press` | | |
| `--on-ink-2` | `#B7B5AF` | secondary text on ink fills (start bar duration unit) | 8.55 on `--ink` · 6.32 on `--ink-press` | | |
| `--ink-press` | `#34312C` | hover and pressed state of ink fills | | | |

### 3.2 Dark · 墨

Set by `data-theme="dark"` on any element, or by the system preference when `<html>` has no `data-theme="light"`. Players are always dark.

| Token | Value | on `--paper` `#121110` | on `--paper-sunk` `#0B0A09` | on `--paper-raised` `#1C1A17` |
| --- | --- | --- | --- | --- |
| `--ink` | `#EDE7DB` | 15.32 | 16.06 | 14.10 |
| `--ink-2` | `#B7AFA2` | 8.68 | 9.11 | 7.99 |
| `--ink-3` | `#918A7E` | 5.52 | 5.78 | 5.08 |
| `--line` | `#6E675D` | 3.38 | 3.54 | 3.11 |
| `--rule` | `#2B2824` | 1.29 | 1.35 | 1.18 |
| `--zhu` | `#E2683F` | 5.65 | 5.92 | 5.20 |
| `--on-ink` | `#121110` | 15.32 on `--ink` · 11.80 on `--ink-press` `#D2CCC0` · 8.68 on `--ink-2` (the dark primary fill) | | |
| `--on-ink-2` | `#3E3C38` | 8.94 on `--ink` · 5.07 on `--ink-2` | | |
| `--fill-primary` | `var(--ink-2)` | primary buttons and the start bar: 8.68 on paper | | |
| `--fill-primary-press` | `var(--ink-3)` | their hover and pressed state; `--on-ink` on it 5.52 | | |

**Primary fills in dark are ink-2, not ink** (`--fill-primary`, `--fill-primary-press`; light mode has no such token and uses ink). Dark is the night mode: a full-ink slab at 15.3 : 1 glares at a dimmed eye, while ink-2 at 8.68 : 1 is still the strongest mark on the screen (today-dark.png, the start bar; distress.png, 「60 秒落地练习」).

**Player surface.** `PlayerFrame` and every sheet opened inside a player carry `data-surface="player"` on the same element as `data-theme="dark"`. There, two more marks step down to ink-2 for the same reason: the 128 px phase word (`--phase-ink`) and the past breath curve (`--trace`). The now-dot stays cinnabar, the future curve ink-3, captions ink.

### 3.3 Translucent and data tokens

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--wash` | `rgb(27 25 22 / .05)` | `rgb(237 231 219 / .06)` | hover on rows, quiet and secondary buttons, table rows |
| `--wash-2` | `/ .09` | `/ .10` | pressed rows, keys and controls (≤ 100 ms; ink-3 on it is 4.34, acceptable for a momentary state) |
| `--scrim` | `rgb(27 25 22 / .36)` | `rgb(0 0 0 / .56)` | behind sheets and dialogs |
| `--selection` | `/ .14` | `/ .20` | `::selection` |
| `--trace-fill` | `/ .07` | `/ .07` | wash under the past breath curve — players only (a reading page draws the line alone) |
| `--grid` | `/ .07` | `/ .05` | 1 s and 5 s grid inside figures |
| `--grid-major` | `/ .14` | `/ .11` | 10 s grid, top and bottom rules of the breath curve, the now line |
| `--zhu-wash` | `rgb(179 58 33 / .12)` | `rgb(226 104 63 / .16)` | reserved; not used in v1 |

Data aliases — figures reference these, never raw ink: `--trace` (= ink: drawn breath, data lines; ink-2 on the player surface), `--trace-future` (= ink-3: curve ahead of now), `--bar` (= ink-2: minutes, counts), `--dot` (= ink: a practised day), `--now` (= zhu). A day without practice has **no** token: it draws nothing. The aliases and `--focus` are declared on `:root` **and on every `[data-theme]` element**: a custom property that uses `var()` is resolved where it is declared, so an alias declared only on a light `<html>` hands the light ink to a player that sets `data-theme="dark"` on its own root (a v1.0 defect, fixed in `tokens.css`).

### 3.4 Where cinnabar may appear (exhaustive)

1. The seal: in the lockup, the app icon, the favicon.
2. *Now*: the now-dot on the breath curve, the focus timeline, the step chart and section strip in guided players, the box pacer and the pace-finder curve.
3. *Today*: the weekday label and its 10 px rule in week dots; the day numeral and its 10 px rule in the month calendar; the dots for today's sessions in the 回神 dot plot.

Nothing else. Cinnabar never fills or outlines a button, never colours a link, focus ring, selection, error, warning, destructive action, icon, grade, badge or the 「不舒服？」 chip, and it never means "missed". One cinnabar mark per figure.

### 3.5 Errors, warnings and success without colour

- **Error** (a field, an import): message 13/20 in `--ink`, preceded by `i-info` 16 px, directly under the control; the field's boundary becomes `inset 0 0 0 2px var(--ink)`; `aria-invalid="true"` and `aria-describedby` point to the message.
- **Safety text** (stop guidance, the emergency line, a practice's 安全 lines): body size in ink, never smaller or dimmer than the text around it. A number is a `tel:` link in Inter 600, underlined in ink (distress.png: 「请立即拨打 <u>120</u>」).
- **Success**: a toast in plain words (§8.13). No check-mark animation, no green.
- **Destructive**: an outline-ink danger button with the trash icon, then a confirming dialog (§8.3).

### 3.6 Themes

- 设置 › 外观: 跟随系统 / 浅色 / 深色 → no attribute, `data-theme="light"` or `data-theme="dark"` on `<html>`. Tokens handle `prefers-color-scheme` when there is no attribute.
- Players, the lead-in, the pause panel and every sheet opened inside a player are dark: `PlayerFrame` sets `data-theme="dark" data-surface="player"` on its root, and sheets opened from a player carry both attributes on their own root. The summary after a practice is in the app theme again.
- `<meta name="theme-color">`: `#F4F1EA` (light) and `#121110` (dark), two metas with `media` queries, updated by script when a theme is forced and set to `#121110` while a player is open.
- Manifest: `background_color` and `theme_color` `#F4F1EA`.
- `color-scheme` comes from the tokens (native scrollbars, date and time inputs).

### 3.7 More contrast, forced colours

- `prefers-contrast: more`: `--ink-3` takes the ink-2 value (7.90 / 8.68), `--line` becomes `#5F594F` (6.15 on paper) / `#918A7E` (5.52), `--rule` becomes `#A9A193` / `#4A453F` so hairlines read as boundaries.
- `forced-colors: active`: fills become `CanvasText` borders (primary button, start bar, toast, toggle, grade box, the 回神 key and count-pad keys); selected segment, choice and scale cells and the current filter option get a 2 px `Highlight` outline; cinnabar marks keep their colour (`forced-color-adjust: none`) because they carry *now* and *today*.

---

## 4. Typography

### 4.1 Families and font files

Three families. Two are self-hosted woff2 subsets built at install time by `scripts/build-fonts.mjs`; body text uses the system CJK sans and is never downloaded. No CDN, no Google Fonts (unavailable in mainland China).

| CSS family / weight | Role | Output file (`public/fonts/`) | Source (`node_modules/.cache/huishen-fonts/`) | Instance and axes | Characters | Size (measured) |
| --- | --- | --- | --- | --- | --- | --- |
| `"HS Display"` 600 | titles, section heads, practice names, sheet and dialog titles, wordmark, 回神 key, empty-state titles, section names in players, summary questions | `display.woff2` | `NotoSerifSC-VF.ttf` (Noto Serif SC 2.003, OFL) | static instance, **wght = 600** | every Han character, CJK punctuation and full-width form in `src/**/*.{ts,tsx}` (tests, `__checks__`, `__measure*` and comments excluded) and `index.html`, plus · — … “ ” ‘ ’ and the figures 0–9 (a serif heading such as 「10月」 keeps serif figures instead of falling back to a system serif) | 1,263 characters · ≈ 221 KB |
| `"HS Display"` 300 | the phase word only | `display-light.woff2` | same | static instance, **wght = 300** | 吸 再 停 呼 准 备 | 2.3 KB |
| `"HS Num"` 300–600 | every Latin letter, figure and listed sign in UI text and data | `num.woff2` | `Inter-VF.ttf` (Inter 4.001, OFL) | variable, **wght 300–600, opsz 14–32** (opsz follows the font size) | U+0020–007E, U+00A0, U+00B0, U+00B1, U+00D7, U+2009, U+2013, U+2032, U+2033, U+2190–2193, U+2212, U+2248, U+2264, U+2265 | 65.6 KB |
| system | body text (CJK in UI text and paragraphs) | — | — | — | — | 0 |

Total download ≈ 289 KB (budget ≤ 900 KB). The light instance's `@font-face` carries `unicode-range: U+5438, U+518D, U+505C, U+547C, U+51C6, U+5907` so it can never be chosen for any other character; preload `display.woff2` and `num.woff2` in `index.html` (`display-light.woff2` loads with the first player, `font-display: block`, 2 KB).

Not used, by decision: Noto Sans SC (the system face is sharper at UI sizes and costs nothing), LXGW WenKai, Source Serif 4, Newsreader, and IBM Plex Mono — monospaced figures make health data read like code, and Inter's tabular figures align just as well.

Stacks (`tokens.css`):

```css
--font-display: "HS Display", "Noto Serif SC", "Source Han Serif SC", "Songti SC", "STSong", serif;
--font-ui: "HS Num", "PingFang SC", "HarmonyOS Sans SC", "MiSans", "Microsoft YaHei UI",
  "Noto Sans SC", "Source Han Sans SC", system-ui, sans-serif;
--font-num: var(--font-ui);   /* Inter covers the figures through its unicode-range */
```

`HS Num` comes first in the UI stack but its `unicode-range` has no CJK, so Latin letters and figures render in Inter and Chinese in the system face (PingFang SC on Apple, HarmonyOS Sans / MiSans / Microsoft YaHei UI elsewhere). CJK punctuation and the separators · — “ ” are deliberately outside Inter's range, so Chinese keeps its full-width forms.

`scripts/fonts.config.json` (exact):

```json
{
  "fonts": [
    {
      "name": "HS Display 600",
      "out": "public/fonts/display.woff2",
      "source": { "file": "NotoSerifSC-VF.ttf", "url": "https://github.com/google/fonts/raw/main/ofl/notoserifsc/NotoSerifSC%5Bwght%5D.ttf" },
      "ranges": "\\p{Script=Han}\\u3000-\\u303F\\uFF00-\\uFFEF\\u00B7\\u2014\\u2018\\u2019\\u201C\\u201D\\u2026",
      "include": ["src/**/*.{ts,tsx}", "!src/**/*.test.{ts,tsx}", "!src/**/__checks__/**", "!src/**/__measure*", "index.html"],
      "extra": "吸再停呼准备回神0123456789",
      "variationAxes": { "wght": 600 }
    },
    {
      "name": "HS Display 300",
      "out": "public/fonts/display-light.woff2",
      "source": { "file": "NotoSerifSC-VF.ttf", "url": "https://github.com/google/fonts/raw/main/ofl/notoserifsc/NotoSerifSC%5Bwght%5D.ttf" },
      "ranges": "\\p{Script=Han}",
      "include": [],
      "extra": "吸再停呼准备",
      "variationAxes": { "wght": 300 }
    },
    {
      "name": "HS Num",
      "out": "public/fonts/num.woff2",
      "source": { "file": "Inter-VF.ttf", "url": "https://github.com/google/fonts/raw/main/ofl/inter/Inter%5Bopsz,wght%5D.ttf" },
      "ranges": "\\u0020-\\u007E\\u00A0\\u00B0\\u00B1\\u00D7\\u2009\\u2013\\u2032\\u2033\\u2190-\\u2193\\u2212\\u2248\\u2264\\u2265",
      "include": [],
      "extra": " !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~ °±× –′″←↑→↓−≈≤≥",
      "variationAxes": { "wght": { "min": 300, "max": 600, "default": 400 }, "opsz": { "min": 14, "max": 32, "default": 14 } }
    }
  ]
}
```

If `fs.globSync` in the build script does not support `!` exclusions, filter test files in the script instead; the character set must equal "every CJK character a user can ever see". `src/ui/fonts.test.ts` fails when a CJK character in `src` strings is missing from `display.woff2.chars.txt`; re-run `npm run fonts` whenever copy changes.

Rendering (base styles): `font-synthesis: none` (never fake bold or italic), `font-optical-sizing: auto`, `font-kerning: normal`, `-webkit-font-smoothing: antialiased`.

#### 4.1.1 Platform faces and weights

Body text is the system's CJK face, so its weights depend on the platform. Expected results, and what to check before sign-off:

| Platform | Face that renders the UI text | CSS 400 · 500 · 600 render as | Check before sign-off |
| --- | --- | --- | --- |
| iOS, iPadOS, macOS | PingFang SC | 400 · 500 · 600 | the mock-ups (all rendered with PingFang) |
| Windows | Microsoft YaHei UI — Regular and Bold only | 400 · **400** · **700** | records-desktop on Windows 11 in Chrome and Edge |
| Android (Chrome) | the system CJK face reached through `sans-serif` (Noto Sans CJK on most devices; HarmonyOS Sans or MiSans where the OEM made it the system font — web pages cannot select them by name) | 400 · 500 or 400 · 600 or 700, by device | 今日 on a Pixel and on a Xiaomi or Huawei phone |

`font-synthesis: none` stays on: a synthesized bold smears CJK strokes. So on Windows a secondary button's 500 renders as 400, and every 600 in the UI face renders as YaHei Bold. That is accepted, because no distinction in this system rests on weight alone: the current tab also changes its icon and ink step, a selected option is an ink fill, a secondary button has its outline. Serif headings, the wordmark and every figure are self-hosted (HS Display, HS Num) and render the same everywhere. `"HarmonyOS Sans SC"` and `"MiSans"` stay in the stack for desktops where they are installed; on Android they are a no-op.

### 4.2 Type scale

One scale for the whole product; no fluid type; no size outside this table. Line heights sit on the 4 px grid. Sizes are given in px at the default 16 px root; the tokens are rem (see the rules below).

| Role | Class / token | Family | Weight | Size / line height | Tracking | Used for |
| --- | --- | --- | --- | --- | --- | --- |
| micro | `.t-micro` | UI | 400 (600 for the current item) | 11 / 16 | 0.02em | week and calendar labels, keycaps |
| axis | `--fs-axis` (fixed px) | UI / Num | 400 | 11 | 0 (figures) · 0.02em (labels) | every label drawn inside an SVG figure |
| tab label | `.tab` | UI | 400 · 600 current | 11 / 16 | 0.02em | tab bar |
| caption | `.t-caption` | UI | 400 | 13 / 20 | 0.02em | meta, kickers, captions, hints, notes, card field labels, folio |
| body | `.t-body` | UI | 400 · 600 strong | 15 / 24 | 0.02em | UI text, rows, controls, list text, the emergency line |
| button | `.btn` | UI | 600 primary · 500 secondary/danger · 400 quiet | 15 / 24 | 0.02em | buttons |
| reading | `.t-reading`, `.lead` | UI | 400 · 600 for a claim | 17 / 28 | 0.02em | lead paragraphs, evidence claims, focus guide line |
| name | `.t-name` | Display | 600 | 17 / 24 | 0.04em | practice names, summary questions, sheet sub-heads |
| start bar | `.startbar__label` | UI | 600 | 17 / 24 | 0.02em | 开始 |
| head | `h2`, `.t-head` | Display | 600 | 20 / 28 | 0.04em | section heads, empty-state titles |
| wordmark | `.lockup .wordmark` | Display | 600 | 20 / 24 | 0.12em | 回神 in the lockup (matches `logo.svg`) |
| caption (guided) | `.caption` (player) | UI | 400 | 20 / 32 | 0.02em | the spoken line in guided players |
| title | `.t-title` | Display | 600 | 24 / 32 | 0.04em | sheet and dialog titles, section name in a guided player |
| 回神 key | `.huishen-key__label` | Display | 600 | 24 / 32 | 0.24em (with −0.24em right margin) | 回神 |
| readout | `.readout__value`, `--fs-readout` (fixed px) | Num | 300 | 24 / 32 | 0 · tabular | player readouts, spec strips |
| display | `h1`, `.t-display` | Display | 600 | 32 / 40 | 0.04em | page titles, the recommended practice |
| timer | `.t-timer` (fixed px) | Num | 300 | 32 / 40 | 0 · tabular | remaining time in timer and sound players |
| figure | `.t-figure` (fixed px) | Num | 300 | 40 / 48 | 0 · proportional | key figures (records overview, medians, pace-finder result) |
| count | `.t-count` (fixed px) | Num | 300 | 64 / 64 | 0 · tabular | lead-in countdown, 60 s grounding countdown |
| phase | `.t-phase`, `.phase` (fixed px) | Display | 300 | 128 / 128 | 0 | 吸 · 再吸 · 停 · 呼 · 准备 |

Rules:
- At most six sizes on one screen (the mock-ups use 4–6).
- **Units.** Text roles are rem (`--fs-*`, `--lh-*`: 11 px = 0.6875rem … 32 px = 2rem), so the browser's default-font-size preference scales all reading and UI text; at the default they equal the px values above. Instrument figures (readout, timer, key figure, countdown), the phase word and labels inside SVG figures (`--fs-axis`) are fixed px: they are sized to their grid and are already 1.6–8.5 × body text. Browser zoom scales everything. Layout distances stay px.
- **Tracking has three values**: 0.02em for text in the UI face (every button label included — 「开 始」 at 0.08–0.12em read as decorative spacing), 0.04em for the serif display roles, 0 for figures. Two marks keep their own: the 回神 key (0.24em, an instrument label) and the wordmark (0.12em, part of the logo).
- The serif is used only in the Display roles above — never for paragraphs, buttons, data, or below 17 px.
- Weights: 300 (figures ≥ 24 px, the phase word), 400, 500 (secondary and danger button labels), 600 (headings, strong text, current items). Never 700 or more in CSS (Windows renders 600 as YaHei Bold, §4.1.1).
- Text colour steps: ink (primary), ink-2 (descriptions, paragraphs in sheets, values), ink-3 (meta, captions, axis text, hints, placeholders). Nothing lighter than ink-3 is ever text.

### 4.3 CJK rules

- `<html lang="zh-CN">`. Latin names that a screen reader should pronounce in English (journal names, "Wim Hof", DOIs) sit in `<span lang="en">`.
- Line breaking: `line-break: strict` (no 。，、；：？！」』） at a line start, no 「『（ at a line end); `overflow-wrap: break-word` so DOIs and URLs can wrap.
- `text-spacing-trim: trim-start`: an opening 「 at the start of a line sits flush with the margin.
- Punctuation is full-width: ，。、；：？！「」『』（）——……·. Quotes are 「」 with 『』 nested; never “” around Chinese.
- **Last lines.** Headings use `text-wrap: balance`, everything else `text-wrap: pretty`. A paragraph, caption, hint, note, list item or row that wraps ends on **at least four characters, punctuation included** — on pages, in sheets and in rows. 「呼吸。」 or 「东西。」 alone at the end of a two-line paragraph looks unedited, worst of all on a safety sheet. `text-wrap: pretty` does not guarantee this for Chinese, so the text helper binds the last four characters with `keep()` (a `white-space: nowrap` span, `.keep`); a raised note numeral does not count as a character. If a line still ends short (a narrow column, a long word), shorten the copy and report it to the content owner. The build audits every block (§14.4). At 200 % text the rule still holds inside each clause, but a short line is accepted when the reader has chosen size over setting.
- **Phrase wrapping** for spoken and safety text and for figure captions: the guided caption, the focus guide line, stop guidance, the emergency line, the 不舒服？ and pause sheets, and 「图 1」 captions break only after ，；：。？！ — `clauses()` wraps the text after each mark in `<span class="clause">` (`display: inline-block`), so a line ends at a pause, like a subtitle (player-guided.png: 「想保持清醒，可以睁开眼睛，」/「或者坐起来。」). The last clause is also bound by `keep()`. A clause longer than the column wraps normally. Other text — notes, hints, card fields, long paragraphs — wraps naturally: clause wrapping on long notes leaves ragged lines.
- No italics; `em`, `i`, `cite` are upright. Emphasis is weight 600 in ink — never colour, never underline (underline means link).
- Tracking by role (§4.2). Latin and figures never take tracking (`--tr-num: 0`).
- Measure: running text ≤ 34em (`--measure`), i.e. ≤ 34 characters per line at reading size; the desktop reading column is 640 px.
- Paragraphs have no first-line indent; 8 px between paragraphs in sheets and cards, 12 px on reading pages.
- Step numbers in 做法 are `01 02 03` (decimal-leading-zero, Inter tabular, ink-3); short numbered lists inside sheets use `1 2 3`.
- Ellipsis in copy is 「……」 (two U+2026). CSS truncation `…` is allowed only inside table cells.
- The metadata separator is space · space (U+00B7): 「10 分钟 · 溪流」. The dot comes from the CJK face and sits centred.

### 4.4 Mixed CJK–Latin, dates and figures

- **Spacing lives in the copy.** A normal space separates Han from figures and Latin (「5 分钟」「4-7-8 呼吸」「DASS-21」) per PRODUCT.md §11. `text-autospace: no-autospace`, so the browser never adds its own.
- **One rule for dates and quantities: calendar references never take spaces; quantities always do.** Calendar references are written solid — 「2026年10月」「10月」「10月22日」「10月1日–22日」「周四」「星期四」, clock times 「08:05」, percentages 「73%」. Quantities take the space — 「8 周」「2 个月」「3 天」「10 分钟」「第 3 周第 2 天」. `lib/date` produces the calendar forms. A month heading is 「10月」; a month in a folio or a card is 「2026年10月」; a search date in an evidence card 「检索到2022年2月」.
- **ISO dates** (「2026-10-22」) appear only in 「最后核实：2026-10-22」 beside the help numbers, where the exact day matters and the form must not change.
- **Proper nouns keep their official form**: 「希望24热线」, 「NCT05676658」. No spacing rule applies inside a name.
- **A quantity binds to its unit.** At render time, the space between a figure and a following unit or classifier — 天 周 次 分 秒 项 人 轮 条 段 处 页 岁 个 — becomes U+00A0, so 「10 分钟」 never splits across lines. 年 月 日 are not on the list: they belong to calendar references, which have no space to bind. Statistics bind their operator the same way: 「p = 0.765」「g = −0.35」「n = 400」「ηp² < 0.001」. Implement once as `bindUnits(text)` in `src/ui/text.ts`, applied by the text components to content strings at render (content files stay as written). The mock-up build applies the same rule.
- Ranges use an en dash without spaces: 「4.5–6.5」「5–10 分钟」「08:05–08:15」「10月1日–22日」. Negative numbers use the minus sign U+2212: 「−0.35」, never a hyphen.
- **Times and countdowns.** Times are 24-hour 「08:05」. Remaining and elapsed time is always `mm:ss` with two-digit minutes — 「06:15」 in a readout and 「已练 03:45 · 还剩 06:15」 in the pause panel; from one hour on, `h:mm:ss` (sleep sounds). Durations in minutes 「10 分钟」, approximate 「约 7 分钟」; seconds 「3 秒后吸气」.
- Units: 次/分 for breathing rate, 分钟, 秒, % without a space, × (U+00D7) for multiplication.
- **Content lint** (requested, §14.3): a test over `src/content` fails on a figure followed by a space and 年, 月 or 日, and on a rate printed with 次/分 without one decimal.

### 4.5 Numerals

- Every figure is Inter (`HS Num`). `.tnum` (`tabular-nums lining-nums`) for anything that ticks or aligns: timers, readouts, counters, axis labels, table columns, phone numbers, the 0–10 scale, the count pad. `.pnum` (`proportional-nums lining-nums`) for a figure standing in text or as a key figure.
- Figures ≥ 24 px are weight 300 (readout 24, timer 32, key figure 40, countdown 64). Figures in text take the text's weight. A figure is never bolded for emphasis; the only figures at 600 are the grade letter, the current value on a slider scale, a selected 0–10 cell, today's calendar numeral and a dialable number in running text (「120」).
- Units after a large figure: 13 px caption, ink-2, regular, 3 px gap (`.unit`), on the figure's baseline: 「5.5 次/分」「7 次」.
- Numeric table columns are right-aligned; values in one column keep the same number of decimals (5.5 / 6.0).
- **Breathing rates always carry one decimal** wherever they are printed with 次/分 or on a scale: slider labels 4.5 · 5.0 · 5.5 · 6.0 · 6.5, readouts, the 有点急 hint 「已加快到 6.0 次/分」, records 「29 轮 · 5.5 次/分」. Running prose such as 「每分钟 6 次」 follows normal writing.
- Phone numbers are grouped as they are dialled: 12356 · 400-161-9995 · 120 · 110.

---

## 5. Space and layout

### 5.1 Spacing

A 4 px unit and an 8 px rhythm. Tokens: `--sp-1` 4 · `--sp-2` 8 · `--sp-3` 12 · `--sp-4` 16 · `--sp-5` 20 · `--sp-6` 24 · `--sp-8` 32 · `--sp-10` 40 · `--sp-12` 48 · `--sp-16` 64 · `--sp-20` 80 · `--sp-24` 96. Components use no other distances; the few 2 px optical nudges are written in `components.css` next to the element they correct.

Standard distances on phone:

| Between | Value |
| --- | --- |
| Screen edge → content | 20 (`--margin`); 16 below 360 px wide |
| Masthead, navbar | 44 high |
| Page title → folio rule | 12 |
| Section → next section (to its 1 px rule) | 40 (`.section`) |
| Section head (including its rule) | ≥ 48 high |
| Practice row | ≥ 60 high, 8 vertical padding |
| List row | ≥ 52 high, 12 vertical padding |
| Glyph column → row text | 16 |
| Paragraph → paragraph | 8 (sheets, cards) · 12 (reading pages) |
| Lead paragraph → figure | 16–24 |
| Stacked buttons | 12 |
| Last content → tab bar | 24 |

### 5.2 Breakpoints

| Name | Width | Navigation | Side margin | Content |
| --- | --- | --- | --- | --- |
| phone-s | < 360 | bottom tab bar | 16 | one column |
| phone | 360–767 | bottom tab bar | 20 | one column, at most 560 wide, left-aligned |
| tablet | 768–1023 | compact rail, 80 | 32 | reading column 640, or the 8-column grid where §13 says so |
| desktop | 1024–1439 | rail, 240 | 48 | 12-column grid, at most 1104 wide |
| wide | ≥ 1440 | rail, 240 | 48 | 12-column grid, 1104, left-aligned — the extra width stays empty on the right |

Breakpoints are widths, implemented in `components.css` (§8.12, §8.13, §8.15.18). A phone on its side (844 × 390) is ≥ 768 wide, so app pages get the compact rail; players switch to their landscape layout by height (`orientation: landscape` and `max-height: 499px`).

### 5.3 Phone frame (reference 390 × 844)

- `viewport-fit=cover`; safe areas from `--safe-top/-bottom/-left/-right` (`env()`), the mock-ups use 47 / 34.
- **Tab roots** (今日 · 练习 · 记录 · 依据): content starts at `--safe-top`; the top is the masthead (今日) or a page head (the others, §8.0). The tab bar is fixed at the bottom: 49 + safe-bottom. Content bottom padding: tab bar + 24 (`.page`).
- **Pushed pages** (practice detail, settings and its sub-pages, programme, help): navbar 44 with a back label. The tab bar stays visible, except on pages with a dock (practice detail, summary) and in players, the welcome flow and pace-finder runs. Bottom padding 24 (`.page--bare`) or dock height + 24 (`.page--dock`).
- **Players**: full screen, no tab bar, no navbar; the HUD starts at safe-top, the controls end at safe-bottom + 8.
- **Sheets** rise from the bottom, at most `100dvh − safe-top − 12`. Sheets inside a player (不舒服？, 已暂停) start 112 px from the top, so the dimmed HUD with 「已暂停」 stays readable above them.
- **Landscape phones** (height < 500): pages scroll as usual; players use the two-column layout (§13.5.12).

### 5.4 Tablet (768–1023)

- Compact rail, 80 wide, hairline on its right: the seal (24 × 25.6, cinnabar) at top 32; four items below it, each 64 high: icon 24 above an 11 / 16 label, current item on `--paper-sunk` with radius 4 and the `-on` icon; 求助方式 and 设置 at the bottom.
- Content 32 from the rail. Most pages: reading column 640, left-aligned. 记录 and 依据: 8 columns of 64 with 24 gutters (680).
- Sheets become centred dialogs 480 wide (radius 14), except sheets inside a player, which stay bottom sheets at most 560 wide.

### 5.5 Desktop (≥ 1024; reference 1440 × 900)

- **Rail** 240 wide (`--rail-w`), padding 32 / 16 / 24, hairline on its right, sticky full height. Lockup at the top (margin 0 12 40). Items 44 high, 12 inner padding, 12 between icon and label, radius 4; inactive ink-2 → hover `--wash` and ink; current `--paper-sunk`, ink, 600, `-on` icon. Foot: 求助方式 (`i-help`) and 设置 (`i-settings`), then under a hairline the caption 「离线可用。练习记录只保存在这台设备上。」 (records-desktop.png).
- **Content**: padding 40 top, 48 left and right (`--margin-desk`), 64 bottom; at most 1104 wide (`--content-max`), aligned to the rail — never centred in the window.
- **Grid**: 12 columns of 70 with 24 gutters (`--col`, `--gutter`). Common spans: 4 + 4 + 4 (records overview), 7 + 5 (main figure + side figure), 8 + 4 (reading + aside), 3 + 7 (filter + list). Reading column 640.
- **Page head**: h1 display 32 / 40; subline caption ink-3 4 below; actions right, aligned to the subline's baseline (small secondary buttons); a 1 px ink rule 16 under the head; content starts 20 below the rule.
- **Pushed pages** keep the rail; the back link sits above the h1 as a caption-size link with a chevron (44 high target).
- **Sheets** become dialogs: centred, 480 wide for content sheets, 400 for confirmations, radius 14, `--shadow-pop`, scrim. A sheet inside a player becomes a right-hand panel, 420 wide, full height, hairline on its left, no radius.
- **Players** fill the window (no rail), dark. The stage is a 640 column centred in the window — the one place where content is centred, because a player is a single instrument. The breath curve spans the full window width; readouts and controls sit in the 640 column.
- **Pointer**: hover states as specified per component; `cursor: pointer` only on interactive elements.

### 5.6 Layers

`--z-bar` 20 (tab bar, dock, sticky rail) · `--z-sheet` 40 (scrim, sheet, dialog) · `--z-toast` 50 (toast).

---

## 6. Shape, rules and elevation

### 6.1 Radii

| Token | px | Used on |
| --- | --- | --- |
| `--r-0` | 0 | rows, tables, rules, figures, page sections |
| `--r-1` | 2 | grade box, bar data ends, keycaps, the 「自评」 tag |
| `--r-2` | 4 | buttons, start bar, chips, text fields, stepper, segmented, choice and scale groups, rail items, icon-button hover |
| `--r-3` | 8 | 回神 key, count-pad keys, toasts |
| `--r-4` | 14 | sheet top corners, dialogs |
| `--r-full` | 999 | toggle, slider thumb, sheet grabber, dots |

Nothing else is rounded. There are no cards to round.

### 6.2 Rules and lines

- **1 px ink rule** — opens a section: section heads, the masthead's dateline, the page-head folio, an evidence card, the summary's data block, the desktop page head, the table head. One per section; two never stack within 40 px.
- **Hairline** (`--hair` in `--rule`) — between rows, under the folio, between readouts, around player controls, between figure columns.
- **Line** (1 px `--line`) — the boundary of a control: outline buttons, chips, fields, stepper, choice and scale groups, the off toggle, the slider track.
- Vertical hairlines appear only inside grouped cells: readouts, spec strips, the help dial grid, desktop overview columns.

### 6.3 Elevation

Hairline first. A shadow only on things that float above the page:

| Token | Light | Dark | Used on |
| --- | --- | --- | --- |
| `--shadow-sheet` | `0 -1px 0 var(--rule), 0 -8px 24px rgb(27 25 22 / .06)` | `0 -1px 0 var(--rule)` | bottom sheets |
| `--shadow-pop` | `0 0 0 1px var(--rule), 0 8px 24px rgb(27 25 22 / .08)` | `0 0 0 1px var(--rule)` | dialogs, desktop panels |
| `--shadow-knob` | `0 0 0 .5px rgb(27 25 22 / .18), 0 1px 2px rgb(27 25 22 / .16)` | stronger black | toggle knob, slider thumb — knobs that sit on a track |

Nothing in the page flow has a shadow — not rows, not the start bar, not the tab bar, not a selected option. Dark mode uses no blurred shadows at all.

---

## 7. Motion

### 7.1 Tokens

| Token | Value | Use |
| --- | --- | --- |
| `--dur-press` | 100 ms | press feedback; a 回神 tick dropping onto the timeline; a count-pad press |
| `--dur-state` | 180 ms | toggle, segment, tab, focus, choice selection |
| `--dur-move` | 240 ms | list insert and remove, disclosure, toast in and out, caption cross-fade, dialog in |
| `--dur-sheet` | 320 ms | sheet in, scrim |
| `--dur-phase` | 700 ms | phase word cross-fade (吸 → 呼) |
| `--dur-scene` | 900 ms | entering a player: the page dims to the dark ground; leaving it for the summary |
| `--ease-standard` | `cubic-bezier(0.2, 0, 0, 1)` | everything that enters or settles |
| `--ease-exit` | `cubic-bezier(0.4, 0, 1, 1)` | everything that leaves |
| `--ease-breath` | `cubic-bezier(0.37, 0, 0.63, 1)` | the CSS approximation of (1 − cos πt) / 2; only for non-canvas breath hints (none in v1) |

All durations are 0 under `prefers-reduced-motion: reduce` (tokens.css).

### 7.2 Rules

- Animate `opacity` and `transform` only (plus `background-color` for press feedback). Never animate layout properties.
- **Hover exists only where a pointer hovers**: every hover style sits inside `@media (hover: hover) and (pointer: fine)`. On a touch screen a tapped row would otherwise keep its hover wash after the finger lifts (a row stays tinted when the person comes back to the list). Pressed (`:active`) states are unconditional.
- No bounce, spring, overshoot, parallax, shimmer, scale-on-press or auto-play.
- Route changes and tab switches are instant (no slides). Focus moves to the new page's h1 (§11).
- Sheet: `translateY(100%) → 0`, 320 standard; scrim opacity 0 → 1, 320; out 240 exit. Dialog: opacity 0 → 1 and `translateY(8px) → 0`, 240 standard; out 180 exit. Toast: opacity and `translateY(8px)`, 240; visible 4 s (6 s with an action; hover or focus pauses the timer).
- Disclosure (evidence card, method note, settings help): `grid-template-rows: 0fr → 1fr` in 240 standard; the chevron rotates 180°.
- Entering a player: the start control shows its press state (100), the route changes, the ground fades from the app theme to the dark ground in 900 standard, then the lead-in begins (PRODUCT.md §5). Leaving for the summary reverses it.
- A new 回神 tick grows from the baseline (`scaleY(0) → 1`, origin bottom) in 100. Counters and readouts change without animation.

### 7.3 Breath visuals (breath curve, box pacer)

- **Canvas, not DOM.** `BreathCurve` and `BoxPacer` draw on a `<canvas>` sized to its CSS box × `devicePixelRatio` (at most 3). They redraw on `requestAnimationFrame` while the player is visible, at the display's refresh rate — 60 fps is the target, never below 30, no `setInterval`, no layout reads inside the frame.
- **Time from the engine.** Each frame reads `session.time()` (the AudioContext-based clock, ARCHITECTURE.md) and samples the pattern with `patternAt()` from `@/engine/patterns`. Never accumulate frame deltas; never animate the curve with CSS. Easing is the engine's: `inout` = (1 − cos πq) / 2 for 吸 and 呼, `out` = sin(πq / 2) for the sigh's 再吸, `flat` for 停. The picture is exactly what the audio cue follows.
- **Window**: 24 s of past and 14 s of future; *now* sits at 24 / 38 = 63.2 % of the width. The 5 s grid is fixed to session time, so it scrolls with the curve.
- **No flashing.** Nothing changes luminance more often than once every 3 s; nothing blinks, pulses or glows; the now-dot never pulses; no full-screen colour or brightness follows the breath; the phase word cross-fades by opacity in 700 ms.
- **Reduced motion**: the curve stops scrolling — it draws one full cycle of the current pattern fixed across the width, and the now-dot travels along it (the moving dot is the pacing information, so it stays: WCAG 2.3.3, essential). The phase word switches without a fade. The box pacer's dot still travels the square. UI durations are 0.
- **Colours** are read from the CSS variables once per theme change (`getComputedStyle`), never per frame.
- On `visibilitychange` to hidden, stop the loop; on return, draw the current frame from `session.time()` with no catch-up animation.

### 7.4 Haptics

With 振动 on and `navigator.vibrate` available: 10 ms at the start of each 吸 and 呼 in paced players; 15 ms on a 回神 or count-pad press. iOS browsers do not support it; there is no fallback and no message beyond the setting's hint.

---

## 8. Components

Numbering follows `components.css`. Every component is specified in light and dark; dark changes only the tokens unless stated.

### 8.0 Page scaffolding

- `.page` — phone page with a tab bar. `.page--dock` — page with a docked bar (bottom padding 56 + 24 + safe-bottom + 24). `.page--bare` — pushed page without a dock.
- **Masthead** (今日 only): 44 high. Left: the lockup — seal 18 × 19.2 in `--zhu`, 10 gap, wordmark 「回神」 display 600 20 / 24, tracking 0.12em; the lockup is a link to `/` with `aria-label="回神 · 今日"`. Right: icon button `i-settings` (the gear, `aria-label="设置"`). The page's h1 is a visually hidden 「今日」 (TODAY.title) at every breakpoint (§13.1).
- **Dateline** (under the masthead): 1 px ink rule on top, hairline below, 4 px vertical padding, caption: the date 「10月22日 星期四」 in ink on the left, the solar-term phrase 「霜降前一日」 in ink-2 on the right (`lib/solar-terms`).
- **Page head + folio** (练习, 依据, phone 记录): h1 display 32 / 40 at padding-top 12; the folio 12 below it — 1 px ink rule on top, hairline below, 4 px padding, caption ink-3; one figure may be ink-2. Left: what the page holds (「17 项练习」「174 条出处，逐条核对」「10月1日–22日 · 29 次练习」); right: a qualifier (「时长为默认值」「最后核对：2026年10月」「只在这台设备上」). See practices.png, evidence.png, records.png.
- **Navbar** (pushed pages): 44 high; left the back link — `i-back` 24 (−2 px right margin) + the parent's name (「练习」「设置」「今日」), ink, 44 high target; right: icon buttons when needed. No centred title: the page's h1 sits in the content.

### 8.1 Type helpers

- `.kicker` — caption ink-3, space-between. A `b` inside is ink-2 600 (the programme name). Above titles: 「八周正念 · 第 3 周第 2 天」 on the left, the grade mark on the right.
- `.lead` — reading 17 / 28, ink-2: the first paragraph under a title.
- `.unit` — caption, ink-2, after a figure.

### 8.2 Section head

`.section` margin-top 40. `.section-head`: at least 48 high, padding-top 4, 1 px ink rule on top; the h2 (display 20 / 28, 0.04em) on the left; on the right an `.aside` (caption ink-3: 「10 项」「改动会记住」「3–20 分钟，默认 5 分钟」), a link-more (「全部依据 ›」) or icon buttons (the ‹ › month buttons in 记录). Never an icon before the heading, and never a safety route in a section head — 现在有点难 is a row of its own (§8.6).

### 8.3 Buttons

| Variant | Default | Hover (pointer) | Pressed | Focus-visible | Disabled |
| --- | --- | --- | --- | --- | --- |
| primary `.btn--primary` | `--fill-primary` fill (ink in light, ink-2 in dark), `--on-ink` label 600 | `--fill-primary-press` (ink-press light, ink-3 dark) | same | 2 px ink ring, offset 2 | `--paper-sunk` fill, ink-3 label, no ring |
| secondary `.btn--secondary` | no fill, inset 1 px line, ink label 500 | `--wash` | `--wash-2` | ring | as primary disabled |
| quiet `.btn--quiet` | no box, ink-2 label 400; 44 high, 4 side padding | ink label | ink label on `--wash-2` | ring | ink-3 label |
| danger `.btn--danger` | no fill, inset 1 px **ink**, ink label 500, `i-trash` 20 | `--wash` | `--wash-2` | ring | not used disabled |
| icon `.icon-btn` | 44 × 44, icon 24 ink | `--wash`, radius 4 | `--wash-2` | ring | icon in `--line` |
| link-more `.link-more` | ink-2 text + `i-chevron-right` 16 ink-3, 44 high | ink text | ink text | ring | — |

- Sizes: default 48 high, 24 side padding, radius 4, label 15 / 24 tracking 0.02em (every label; there is no wider tracking for short labels), icon 20, gap 8. Small `.btn--small`: 36 high (a `::before` extends the hit area to 44), 12 side padding, label 13 / 20, icon 16. `.btn--block`: full width. Hover rules apply only to fine pointers (§7.2).
- Labels are verbs or verb phrases: 开始 · 继续 · 结束 · 完成 · 导出 CSV · 删除全部 · 生成日历文件. One primary per view; a start bar counts as the primary.
- Icon-only buttons exist only as `.icon-btn` and always have `aria-label`.
- Destructive flow: danger button → dialog with 「取消」 (secondary) and the verb (danger), e.g. RECORDS.list.confirmDelete; 删除全部数据 takes two dialogs (SETTINGS.data.deleteAll). Never red, never cinnabar.
- No spinners. Actions are local; a longer one (export) disables its button for its duration (≤ 1 s) without changing the label.
- Press feedback is a fill change in 100 ms. No scale, no ripple.

### 8.4 Start bar and dock

- `.startbar`: 56 high, column width, radius 4, `--fill-primary` fill (ink in light, ink-2 in dark). Left: `i-play` 20 + 「开始」 17 / 24 600 tracking 0.02em in `--on-ink`. Right: the duration that will actually run, 「10 分钟」 — figure `--on-ink` (15, proportional), unit `--on-ink-2`. Hover (fine pointer) and pressed `--fill-primary-press`; focus ring.
- Used inline on 今日 (under the recommendation's figure) and docked on the practice detail.
- `.dock`: fixed bottom, `--paper`, hairline on top, padding 12 / 20 / 12 + safe-bottom (`--dock-h` 80 + safe-bottom). The summary's 「完成」 uses the same dock with a primary block button. PageFrame sets `data-bars="dock"` on `<html>` so keyboard focus scrolls clear of it (§11). On desktop the start bar is inline, not docked.
- A start bar is never disabled. If audio cannot start, the practice starts silently and the player shows the audioBlocked toast.

### 8.5 Grade mark

- The boxed letter: 18 × 18, 1 px ink border, radius 2, Inter 600 11 px, ink; then the grade word (强 · 中等 · 有限 · 不足) caption ink-2 at a 6 px gap (5 px in catalogue rows); optionally prefixed by 「证据」 caption ink-3 (Today kicker, practice detail kicker, evidence card kicker).
- Screen readers: the box is `aria-hidden`; a visually hidden 「证据等级 B，」 precedes the word, which reads 「证据等级 B，中等」.
- Shown on: the Today kicker, the practice detail kicker, each claim line of a practice's 依据 (§8.10), evidence cards (full and collapsed), the 未采用 list, the grade definitions — always with its word. **Catalogue rows** show the letter alone, 8 px after the practice name and centred on the CJK body (`.prow__name .grade__box`); the words are explained once in the legend under the catalogue, and screen readers still hear 「证据等级 B，中等」 after the name.
- Never colour-coded, never a pill, never a letter grade for a user's own data.
- Tools without health claims (静坐计时, 舒适节律探索) show no grade mark. `.grade--none` (line border, ink-3 letter, 「—」) is reserved for tables where a column must stay filled.

### 8.6 Practice row and breath glyph

**Row** `.prow`: grid `48px | 1fr | auto`, column gap 16, items centred, at least 60 high, padding 8 0, hairline below (none after the last row of a group). Name: display 17 / 24, 0.04em. Description: caption ink-2, one or two lines, never truncated, last line ≥ 4 characters (§4.3). End column, right-aligned, one of:
- (a) **duration** — 「1 分钟」: figure 15 proportional ink + unit 13 ink-2 (今日 · 只有几分钟; the 练习 catalogue, where 舒适节律探索 reads 「约 7 分钟」 and the grade letter follows the name, §8.5; today.png, practices.png);
- (b) **programme length** — 「8 周」 (programme rows);
- (c) **chevron** — `i-chevron-right` 16 ink-3, for the navigation variant below.

**Navigation variant** `.prow--nav` (今日 · 现在有点难, today.png): at least 52 high; the glyph column holds the `grounding` glyph, so the text sits on x = 84 like every row; the label in the UI face 15 / 24 600 ink; the hint caption ink-3; a chevron at the end. The whole row opens the sheet (`aria-haspopup="dialog"`).

The whole row is one link. States: hover (fine pointer) `--wash` and pressed `--wash-2`, both running to the screen edges (`::after` inset 0 −margin); focus-visible 2 px ink ring on the row box at offset 2 — inside the side margin, not edge to edge (states.png). Practices hidden by the health check are removed, never greyed.

**Glyph**: a 48 × 24 SVG (`viewBox="0 0 48 24"`), stroke 1.25, `currentColor` (ink), no fill, round caps and joins, drawing area y 3.5–20.5. Each practice is drawn as its own structure; paced glyphs are sampled from the engine pattern (`buildPattern` + `patternAt`), never hand-drawn curves. `draw.mjs` → `GLYPHS` and `programGlyph()` are the reference geometry. The vocabulary is closed:

| id | Glyph | Encodes |
| --- | --- | --- |
| `focus` | a baseline with 7 ticks at uneven intervals | each 回神 leaves a tick |
| `breath-count` | a baseline with 8 short ticks and a tall 9th | 1–8, then 9 |
| `body-scan` | a 9-step staircase rising left to right; tread widths are the real 10-minute section timings | feet → head |
| `body-scan-sleep` | a 7-step staircase descending | head → feet |
| `breathing-space`, `breathing-space-coping` | an hourglass: wide → narrow → wide | 觉察 → 集中 → 扩展 |
| `loving-kindness` | a corridor widening in four steps | oneself → someone close → a neutral person → all beings |
| `self-compassion` | three rising treads | the three sentences |
| `open-awareness` | five rays fanning from one point | awareness widening |
| `walking` | a line with alternating up and down ticks | steps |
| `pause` | flat · one breath · flat | 停 · 吸 · 观 · 行 |
| `grounding` | a baseline with four short posts | feet on the ground |
| `timer` | a line between two bells with a tick in the middle | start bell · interval · end bell |
| `slow` | 24 s of the default pattern: 5.5 / min, 吸 4.5 · 呼 6.5 | the real pattern |
| `cyclic-sigh` | one whole sigh, 10.5 s: 吸 2.5 · 再吸 1.0 · 呼 7.0 — a quick rise, the 再吸 shoulder at 78 %, a long exhale tail | the real pattern; one cycle, because two read as 慢呼吸's waves at 48 px |
| `box` | 32 s of 4-4-4-4 with flat holds | the real pattern |
| `pace-finder` | five cycles at 6.5, 6, 5.5, 5 and 4.5 / min, each in its own width | the five steps |
| `listen` | a steady water-like line that fades in its last third | sound with a timed fade-out |
| `sleep` | a slower line fading along its whole length | sound fading into sleep |
| programmes | one 4.5 px square per week (8 or 4), left-aligned | weeks |

A new practice ships only with a glyph designed on this grid — never a generic icon in the glyph column.

### 8.7 List rows and groups

- `.group-title` — caption ink-3, 32 above, 4 below (「放松」「睡前」, settings groups).
- `.list` — hairline on top. `.row` — at least 52 high, padding 12 0, hairline below; the label 15 / 24 ink, optional `.row__hint` caption ink-3 2 below; `.row__value` ink-2 on the right, followed by `i-chevron-right` 16 ink-3 on navigation rows.
- Row types: **navigation** (value + chevron; the whole row is a link); **toggle** (label + hint, toggle right; the whole row toggles; the switch is labelled by the row label); **stacked** `.row--stack` (label on top — a slider row also prints its current value on the right; a segmented row does not, the selected cell already shows it, and a row of bare figures names its unit in the label, 「时长（分钟）」 — the control 12 below, the hint 8 under it); **disclosure** (label + `i-chevron-down` that turns 180°); **destructive** (a danger button at the row end — never the whole row).
- Hover (fine pointer) `--wash`; pressed `--wash-2`; focus ring on the row. Hints are shown in full, never truncated.

### 8.8 Native controls

**Segmented control** `.seg` — an outlined group like `.choice`: inset 1 px `--line`, radius 4, at least 44 high; equal cells, label 15 / 24 ink-2, 1 px `--rule` separators between cells; **the selected cell is an ink fill with `--on-ink` 600** — the one selection idiom of the system (`.choice`, `.scale`, the on toggle) — with no shadow, and the separators beside it disappear. Selected against unselected is 15.55 : 1 (light) and 15.32 : 1 (dark); the raised white segment it replaces was 1.19 : 1 on its track. An optional second line `.sub` (caption, ink-3; `--on-ink-2` when selected) for labels such as 「吸 4.5 · 呼 6.5」. 2–5 cells, labels of at most 4 characters or a short figure. Semantics: `role="radiogroup"` with `aria-label`; cells `role="radio"` with `aria-checked`; roving tabindex; ← → move and select, Home / End; the focus ring is 2 px ink **outside** the cell (offset 2, above its neighbours) — an inset ring would vanish on the ink fill. Pressed: `--wash-2` on an unselected cell. Transition 180. Used for: 时长, 吸与呼, 节拍提示, 引导详细程度, 外观, 间隔钟声.

**Filter row** `.filter` (练习, 依据; practices.png, evidence.png) — not a segmented control: a typographic row of labels 15 / 24 ink-2, the current option ink 600 with a 2 px ink rule along the bottom of its target, over a hairline that spans the column. Each option has 8 px side padding (targets ≥ 44 × 44; text 24 apart) and the row steps out 8 px, so the first label still sits on the margin. Each label reserves its 600 width (`data-label` read by `::before`), so the row never shifts when the selection moves. Radio-group semantics as above; focus ring inset −2. The row scrolls sideways, without a scrollbar, if its labels ever outgrow the column.

**Slider** `.slider` — 56 high. Track 2 px `--line` (radius 1), inset 12 each side; fill ink from the minimum to the value; thumb 24, `--paper-raised`, `--shadow-knob` and an inset 1 px line; ticks under the track: minor 4 px `--line`, major 6 px ink-3; scale labels 11 px tabular ink-3 — rates with one decimal, 4.5 · 5.0 · 5.5 · 6.0 · 6.5 — the current value's label ink 600 (`aria-current`). The value is also printed at the row's right: 「5.5 次/分」. `role="slider"`, `aria-valuemin/max/now`, `aria-valuetext` in words (「每分钟 5.5 次」); ← → by one step (0.5 for 节律), PageUp / PageDown by a major step, Home / End; drag anywhere on the 44 px band; values snap to steps.

**Toggle** `.toggle` — 51 × 31, fully rounded; off: `--paper-sunk` + inset 1 px line; knob 27, `--paper-raised`, `--shadow-knob`; on: ink fill, knob moves 20 (dark: the knob is `--paper`); 180 standard. `role="switch"`, `aria-checked`. Always inside a row of at least 52, which is the hit target.

**Stepper** `.stepper` — 44 high, inset 1 px line, radius 4: [−] 44 | value 64 | [+] 44. The value is Inter tabular with hairlines left and right; an end button at its limit turns `--line` and is disabled; press-and-hold repeats every 150 ms after 400 ms. Buttons are labelled 「减少」「增加」 and described by the value. Used for 开头倒数 (秒), 箱式呼吸's seconds per step, and 静坐计时 (values 1 · 3 · 5 · 10 · 15 · 20 · 30 · 45 · 60).

**Text field** `.field` — at least 48 high, padding 12, radius 4, `--paper-raised`, inset 1 px line; text 15 / 24 ink, placeholder ink-3; focus: inset 2 px ink (no glow); error per §3.5. The 备注 holds at most 200 characters; from 180 on, a counter 「180/200」 appears under it, caption ink-3, right-aligned.

There are no native `<select>` menus: use a segmented control (≤ 5 options) or a pushed list of radio rows.

### 8.9 Figures and data marks

General rules (all figures):
- Data lines 2 px; secondary traces 1.5 px; glyph strokes 1.25 px.
- Dots at least 8 px, with a 2 px ring in the ground colour so they separate from lines and from each other.
- Bars at most 8 px thick, square at the base, rounded 2–3 px at the data end.
- Grids are hairlines (`--grid`, `--grid-major`); axis text 11 px (`--fs-axis`, fixed — figure geometry does not grow with the font-size preference) ink-3 tabular.
- No area fill under a line on a reading page; a fill appears only where it encodes something (the past part of the player's breath curve).
- One series → no legend; the section title names it. No 3-D, no gradients, no shadows.
- Captions under the figure, caption ink-3. On reading pages (practice detail) figures are numbered: 「图 1」 in ink-2 600 followed by the caption.
- Every figure is either `role="img"` with a complete `aria-label` (the values in words) or `aria-hidden` with the same information in adjacent text.

**WeekDots** (今日 · 本周, 记录 overview). Seven day slots, Monday first, labels 一 … 日. A practised day = one solid ink dot (8 px phone, 10 px desktop) above its label. A day without practice — past or still ahead — shows only its label: nothing is drawn (PRODUCT.md §7: 留空, never marked, never red). Past labels ink-2, future labels ink-3. Today: the label in `--zhu` 600 with a 10 × 1.5 px cinnabar rule 4 px under it; its dot (ink) appears above once today has a practice. Slot width 24 (phone) / 30 (desktop). The dots carry frequency only — no bar heights, no minutes (frequency matters more than duration, PRODUCT.md §0). `aria-label`: 「本周，练过 3 天：周一、周三、周四；今天是周四」. today.png, records-desktop.png.

**MonthCalendar** (记录). Seven columns, Monday first; weekday header micro ink-3 over a hairline; cells 50 × 44 (7 × 50 = the 350 phone column; the same on desktop); the numeral micro tabular ink-3 at the top of the cell; a 10 px solid ink dot below it for a practised day; nothing for a day without practice; today: the numeral in `--zhu` 600 with a 10 px cinnabar rule under it (and its dot once practised). No colour by minutes, no heat map. Caption: RECORDS.calendar 「练过的日子是实心点，没练的日子留空。」 `aria-label`: 「10月练习日历：练过 19 天，练过的日子有实心点；今天是 22 日」. The section head is 「10月」 with the previous / next month icon buttons `i-back` / `i-chevron-right` on its right (「上个月」「下个月」; 下个月 is disabled in the current month) — no other text in the head (records.png, records-desktop.png).

**DotPlot** (记录 · 回神次数). x = date; y = 回神 per 10 minutes on a 0–10 axis (extend to the next multiple of 5 above the maximum); hairline grid at 0 / 5 / 10, the 0 line in `--line`; one 8 px dot per focus session, ink-2 with a ground ring; today's sessions `--now`. No trend line, no average, no target. Caption: RECORDS.focus.note.

**Sparkline** (记录 phone · 数息 trend, once there are ≥ 3 sessions; `charts.mjs` `sparkline()`). 120 × 32; a 2 px ink line through the session values on a fixed 50–100 % scale; a 4 px dot at each value, 8 px on the latest; no axes; the latest value printed to its right in tabular ink with the caption 「最近一次」. A session from today gets a `--now` dot.

**CountRows** (记录 desktop · 数息). One row per session: date | the accuracy dot on a 50–100 % track (hairline grid at 50 / 75 / 100) | 「73%」 | 「数乱了 2 次」. Caption RECORDS.count explanation; 「这不是正念分数。」 always shown.

**CheckinStrips** (记录 · 练习前后自评). Two rows (练习前, 练习后) on one 0–10 axis; equal answers cluster three dots wide, stacking up; a vertical 1.5 px ink rule at each median; the two medians printed above as key figures (t-figure) with captions; the 「自评」 tag (caption ink-2, radius 2, inset line) in the section head; captions RECORDS.checkin.noise and .caveat. Shown only after 5 pairs; before that, RECORDS.checkin.notEnough.

**PracticeBars** (记录 · 各练习). Name 112 | 6 px ink-2 bar | 「150 分钟 · 15 次」 128 — the bar takes what is left: 88 px in the 350 phone column and in a 4-column desktop cell.

**StepChart and SectionStrip** — §8.15.7. **BreathSpecimen** (paced practice detail): three steady cycles at the defaults on a seconds axis — the 2 px line, no area fill (a grey wash under three humps read as a stock area chart); 1 s ticks, the 5 s grid, labels every 10 s with the unit on the last label (「30 秒」, never a floating 「秒」); brackets over the first cycle name each phase 「吸 4.5 秒」「呼 6.5 秒」; caption 「图 1 默认节律的 3 轮，约 33 秒。曲线升高是吸气，降低是呼气。」, phrase-wrapped (detail-slow.png). **BreathCurve**, **BoxPacer**, **FocusTimeline** — §8.15. **EffectRows** — §8.10.

### 8.10 Steps, notes, citations, evidence card

- **Steps** (做法): `<ol class="steps">`; each item a grid 1.875em (28 at 100 %) | 1fr, padding 12 0, hairline between; the number `01` caption tabular ink-3; the text body ink, last line ≥ 4 characters.
- **Claims** `.claims` (练习详情 · 依据; detail-slow-full.png): **one graded result per line**. Each item: the claim at reading 17 / 28 600 with its note numerals before the final punctuation, then on its own line the grade mark with 「证据」; hairlines between items; under the list EVIDENCE.grades.scope (caption ink-3). Never two results of different strength in one sentence under one grade — the reader could not tell which result the grade is for.
- **Citation** `.cite`: Inter micro ink-3 raised 0.55em, no underline, links to its note (`#n1`). In running text it is exempt from the 44 px rule (WCAG 2.5.8 inline).
- **Notes** `.note`: hairline on top, padding 12 0, grid 20 | 1fr, caption size. Number ink-3; author and year ink 600 + the study type in ink-3 (实践指南 · 元分析 · 随机对照试验); one line on what it found (ink-2); venue (ink-3) and the DOI link (Inter, ink-2, `i-external` 14).
- **Evidence card** `.ecard` (full; evidence.png) — 1 px ink rule on top, 12 padding-top. The order is fixed (PRODUCT.md §9):
  1. **Kicker**: topic 「呼吸练习 · 压力」 caption ink-3 on the left; the grade mark with 「证据」 on the right.
  2. **结论**: one sentence, reading 17 / 28, 600, ink, that names the comparison (「与不做呼吸练习的对照相比，……」); hairline under it.
  3. **效应量与 95% CI** — a wide field (its label on its own line): for each outcome a text line — the outcome in ink with 「12 项试验 · 785 人」 in ink-3 on the left, 「g = −0.35（−0.55 至 −0.14）」 tabular ink on the right — and under it a 16 px CI row: hairline at zero, the CI as a 2 px ink range with round caps, the estimate as an 8 px ink dot with a ground ring. All rows of a card share one axis, drawn once under the last row (micro tabular ink-3; ticks −0.8 · −0.5 · −0.2 · 0 in the example). Note under the axis, caption ink-3: 「小于 0 表示比对照减轻。效应量约 0.2 算小，约 0.5 算中等，0.8 以上算大。」 When a study reports no interval, print the statistic it does report (「ηp² < 0.001，p = 0.765」) and draw no CI row — never draw an invented interval.
  4. **研究类型、样本与对照** (the design, its size and the comparison; a search date is a calendar reference, 「检索到2022年2月」), 5. **等级** (grade mark + its definition from PRODUCT.md §9), 6. **局限**, 7. **相反证据** (a paragraph and its own citation line with DOI), 8. **DOI** (citation line + DOI link) — exactly PRODUCT.md §9's order. There is **no 可信度 field**: a second rating (高 · 中 · 低 · 很低) under the grade (强 · 中等 · 有限 · 不足) read as the same rating said twice. The grade words are the only rating vocabulary on an evidence surface; a study's own weight is said in plain words inside fields 4 or 6 (「多数研究有中等偏倚风险」 is a finding, not a scale). Fields 4–8: a `dl` grid 76 | 1fr with 12 gap; the term caption ink-3 at line height 24; the description body ink-2 with figures in ink; padding 12 0, hairline between fields, none after the last.
- **Collapsed card** `.ecard--closed`: kicker + claim (15 / 24, 600) + a meta line with the design and its size only (「元分析 · 223 项研究」「探索性随机试验 · 108 人」, caption ink-3) and the 「展开」 disclosure on its right (`i-chevron-down`, 44 high, `aria-expanded`, `aria-controls`); hairline under the meta line. Expanding reveals fields 3–8 in 240 ms; the label becomes 「收起」.
- **DOI links**: Inter, no tracking, ink-2, `i-external` 14 ink-3, `lang="en"`, open in a new tab with `rel="noopener"`; the line is 24 high and a `::before` (−10 px top and bottom) makes the target 44; the focus ring hugs the 24 px line (states.png).

### 8.11 Tab bar (phone)

Phone only (< 768; the rail replaces it above). Fixed bottom; 49 + safe-bottom; `--paper`; hairline on top; four equal tabs 今日 · 练习 · 记录 · 依据 (`i-today` sunrise, `i-practice` breath curve, `i-records` dot calendar, `i-evidence` open book; §9). Each tab: icon 24 at 6 from the top, label 11 / 16 tracking 0.02em 2 below. Inactive: ink-3, outline icon. Current: ink, 600, the `-on` (filled) icon, `aria-current="page"` — the filled icon and the weight carry the state, not colour alone. Pressed: `--wash-2` on the tab cell. Focus ring inset (offset −4), radius 4. No badges, no dots, no centre button. Hidden in players, the summary, the welcome flow and pace-finder runs.

### 8.12 Navigation rail

Desktop 240 and tablet 80 (§5.4, §5.5), switched by `components.css` (`.app` grid; the rail is hidden below 768). The current item: `--paper-sunk` well, ink, 600 and the `-on` icon — the weight and the filled icon carry the state; the well is supplementary (1.13 : 1 light, 1.05 : 1 dark). `<nav aria-label="主导航">`; tab order: lockup → four items → 求助方式 → 设置. Route → current item: `/` → 今日; `/practices`, `/practices/:id`, `/program/:id`, `/pace-finder` → 练习; `/records` → 记录; `/evidence` → 依据; `/help` → 求助方式; `/settings/*` → 设置.

### 8.13 Sheet, dialog, toast

**Sheet** (phone). Fixed to the bottom; at most `100dvh − safe-top − 12` high (player sheets: from 112 below the top, §5.3); `--paper-raised`; radius 14 on the top corners; `--shadow-sheet`; padding 8 / 20 / 0. A flex column: grabber 36 × 5 in `--line`, fully rounded, 8 below it (none on a sheet that cannot be dismissed); head `.sheet__head` (the title, h2 24 / 32, on the left; an optional close icon button on the right, 「关闭」); body `.sheet__body` — **the body scrolls first** (`overscroll-behavior: contain`), the head and the footer never scroll away, also at 200 % text (distress-200.png); optional footer `.sheet__foot` (hairline on top, `--paper-raised`, padding 12 / 0 / safe-bottom + 8) with the actions. Behaviour: `role="dialog"`, `aria-modal="true"`, `aria-labelledby` the title; on open, focus moves to the title (`tabindex="-1"`); focus is trapped; Esc, a scrim tap and dragging the grabber down (> 30 % of the height or > 0.5 px/ms) close it, unless the sheet requires a decision (开始之前, the pace-finder rating); the page behind is `inert` and does not scroll; focus returns to the trigger. Inside a player the sheet is dark.

Sheets in v1: 现在有点难 (今日) · 不舒服？ (players) · 已暂停 (pause panel) · 声音 (player mixer) · 先休息一下 (summary, 很不舒服) · session detail (记录 phone) · 开始之前 (first start) · 练习前自评 (§13.5.13) · 每周压力自评 (§13.7) · the pace-finder rating · choice lists of the reminder sentence.

Tablet and desktop (`components.css`): an app sheet becomes a centred dialog 480 wide (radius 14, `--shadow-pop`, no grabber); a sheet inside a player stays a bottom sheet at most 560 wide on tablet and becomes a 420 right-hand panel, full height, hairline on its left, on desktop.

**Dialog**. 400 wide at most (phone: viewport − 40), padding 24, radius 14, `--paper-raised`, `--shadow-pop`, scrim. Title t-head 20 / 28; body 15 / 24 ink-2, 8 below; actions right-aligned, 24 below, 12 apart: 「取消」 (secondary) first, then the verb. Dialogs exist only for: 结束 in a player, 删除这条记录, 删除全部数据 (two steps), 不限时 sleep sound (UNLIMITED_CONFIRM), 重新开始计划.

**Toast**. Ink fill, `--on-ink` 15 / 24, radius 8, at least 48 high, padding 4 8 4 16; an optional action as an underlined `--on-ink` text button with a 44 target. 12 above the tab bar, dock or player controls, 20 from the sides (desktop: bottom-left of the content, at most 400 wide). `role="status"`. 4 s, 6 s with an action, paused on hover or focus; one at a time, the newest replaces the last. Used for: 「已删除这条记录。」 + 撤销 · import results (SETTINGS.data.import.result) · 「声音没能开始，练习照常进行。」 + 再试一次 · 「已删除全部数据。」 · 「有新版本」 + 更新 (never during a practice; queued until the summary closes).

### 8.14 Empty state

A left-aligned block, padding 32 0: title display 20 / 28 (h2), body 15 / 24 ink-2 8 below, an optional single action 16 below (a secondary button or a link-more). No illustration, no icon, never centred. Copy from content: RECORDS.empty, EVIDENCE.empty. Not-enough-data notes (数息 trend, 自评) are captions inside their section, not empty states.

### 8.15 Player (always dark)

Mock-ups: player-breath.png and player-breath-landscape.png (paced), player-focus.png (focus), player-guided.png (guided), pause.png (pause panel), distress.png and distress-200.png (不舒服？ sheet).

**8.15.1 Frame.** `.player`: min-height 100dvh, column; padding safe-top / 20 / safe-bottom + 8; dark `--paper`. `PlayerFrame` sets `data-theme="dark" data-surface="player"` on its root (§3.2) and `data-bars="player"` on `<html>` (§11). Regions top to bottom, the same in every player: HUD · stage (flex 1, its content centred vertically) · readouts · controls. Tablet, desktop and landscape: §8.15.18.

**8.15.2 HUD.** At least 56 high. Left: the practice name 15 / 24 600 and the meta caption ink-3 — duration · sound (「10 分钟 · 雨 + 长音」), with 「 · 已暂停」 appended while paused. Right: nothing on a phone held upright; the 不舒服？ chip on tablet, desktop and a phone on its side (§8.15.3). There is no close × (结束 lives in the controls).

**8.15.3 Chips, and the safety exit.**
- **不舒服 — always one tap away, never mistaken for a pacing control** (PRODUCT.md §5, §10). On a phone held upright it is the third of four equal **controls** — 暂停 · 声音 · 不舒服 · 结束 — with `i-help`, at the bottom where the thumb is (§8.15.15). On tablet, desktop and a phone on its side it is the **HUD chip** `.chip--unwell`: 44 high visible (not a 36 chip with an extended target), `i-help` 18 in ink, label PLAYER.unwell 「不舒服？」 15 / 24 ink, padding 0 8 0 10 (the full-width ？ carries its own space), inset 1 px `--line`, radius 4 — and the controls are three. Exactly one of the two exists at any size (`components.css` switches both with one media query). Both carry `aria-haspopup="dialog"`, pause the practice and open the 不舒服？ sheet (§8.15.17). The grounding player (落地练习) keeps it; its sheet omits the 「60 秒落地练习」 button.
- **Pacing chips** `.chip` — 有点急, 跳过这一处: 36 high (a `::before` extends the target to 44), padding 0 12, radius 4, inset 1 px line, label 15 / 24 (ink-2 for `.chip--quiet`); optional icon 18 ink-2. Pressed `--wash-2`; disabled: label `--line`; focus ring.
  - **有点急** (慢呼吸 only): right-aligned under the curve, the hint 「点一下，每分钟加快 0.5 次」 caption ink-3 to its left. After a press the hint reads 「已加快到 6.0 次/分」 for 3 s; at 6.5 / min the chip is disabled and the hint reads 「已到上限：6.5 次/分」. `aria-describedby` → PLAYER.paced.hurryHelp.
  - **跳过这一处** (guided practices with skippable sections): `i-skip` 18; shown only while the current section is skippable; after a press it is disabled for 300 ms. `aria-describedby` → PLAYER.guided.skipHelp.

**8.15.4 Readouts.** In every player directly above the controls, 16 apart — one position, so the eye learns it once. Equal columns; hairline on top; vertical hairlines between; padding 8 top, 12 bottom, 12 left after the first column. Label caption ink-3; value Inter 300 24 / 32 (`--fs-readout`, fixed) tabular ink; unit caption ink-2. Remaining time is rounded up, `mm:ss` (§4.4), and shows 00:00 only at the end bell. By kind: paced 剩余 · 节律 · 轮数; box 剩余 · 每步 · 轮数; **focus 剩余 only** — no live 回神 count: the ticks on the timeline show it, and a number that climbs during a sit invites scoring (the count is in the summary, §13.6); guided 剩余 · 这一处还剩 · 下一处 (the last as text 17 / 32 regular; 「这一处还剩」 says it counts down); count 剩余 only (no counts during practice, PRODUCT.md §5); timer 已坐 · 下次钟声; sound 剩余 · 声音. Readouts are not live regions.

**8.15.5 Paced: phase word and breath curve** (player-breath.png).
- Phase row: the phase word `.phase` (display 300, 128 / 128, `--phase-ink` = **ink-2** on the player surface, 8.68 : 1 — a full-ink 128 px glyph glares at a half-closed eye; margin-left −0.04em) on the left; on the right, its bottom 20 above the word's bottom: 「3 秒后吸气」 body ink-2 with the figure in ink (seconds left in this phase, rounded up; 「2 秒后呼气」 during 停). Words: 吸 · 再吸 (the sigh's top-up) · 停 (box holds) · 呼; 准备 during the lead-in. Cross-fade 700 ms by opacity at each phase boundary.
- Curve, 16 below the phase row: full bleed (margin 0 −20), 216 high on phone (150 in landscape) with 18 padding top and bottom inside the canvas; level 1 and level 0 rules in `--grid-major`; vertical `--grid` lines every 5 s (`--grid-major` every 10 s) fixed to session time; past: 2 px `--trace` line (**ink-2** on the player surface) over `--trace-fill`; future: 1.5 px `--trace-future` dashed 2 / 5 with round caps; now: a `--grid-major` vertical line and a 10 px `--now` dot with a 2 px ground ring. No time labels inside the player.
- During the slow-breathing warm-up (≈ 87 s from 8 / min down to the target, two cycles per 0.5 step) the curve shows the faster cycles as they really are, and 节律 shows the current rate.
- 周期性叹息: as above with 吸 · 再吸 · 呼; in place of 有点急, the caption 「节拍只是参考，可以按自己的快慢来。」 (from the practice's steps) under the curve.

**8.15.6 Box pacer** (箱式呼吸). Phase row as above. Under it, a canvas square 200 × 200 (desktop 240), left-aligned with the column: the square in 1 px `--line`; the side of the current phase drawn 2 px ink from its start to *now*; a 10 px `--now` dot with a ground ring on the square. Sides: 吸 = left side, bottom → top; 停 = top side, left → right; 呼 = right side, top → bottom; 停 = bottom side, right → left. The dot's position along a side is the phase's progress (linear in time; the square shows time, the phase word and the cue show the breath). Each side carries its label outside it, micro ink-3: 「吸 4 秒」「停 4 秒」「呼 4 秒」「停 4 秒」. No trailing segment under reduced motion.

**8.15.7 Guided** (player-guided.png). Stage, top to bottom:
- **Where**: kicker 「现在 · 第 4 处，共 6 处」 caption ink-3 (sections that are not skippable read 「现在 · 呼吸」); the section title display 24 / 32 (h1 of the player); the 跳过这一处 chip on the right, aligned to the title's bottom.
- **Strip**, 20 below: the **StepChart** for the body scan, a **SectionStrip** for every other guided practice; full column width. Treads 2 px; past treads ink-2; the current tread ink up to *now*, then 1.25 px `--line` to its end; future treads 1.25 px `--line`; a skipped section's tread dashed 2 / 4 in `--line`. Labels 11 px: past ink-2, current ink 600, future ink-3; each label sits on its own tread so labels never collide. **Each label is the section's title, or its first word when the title is longer than two characters** (`stepLabel`: 开始 · 呼吸 · 左腿 · 右腿 · 臀部 · 胸口 · 双手 · 脖子 · 全身), so the strip, the section title above it and 今日's line 「从左腿开始……」 say the same word. **全身 is simply the top tread** — a filled block read as a highlight or a disabled zone. Now-dot 8 px `--now`. Time axis under it: hairline, a tick every minute (major every 5), labels 「0」「5」「10 分钟」. The body scan climbs one step per section (feet → head; 6 px per step in the player, 5 on 今日); the sleep body scan descends; every other practice keeps all treads on one level (step 0).
- **Caption**, 40 below: 20 / 32 ink, at least 96 high (three lines), phrase-wrapped (§4.3), `aria-live="polite"` — the only live region in a player. A new line cross-fades in 240 ms. During a silence longer than 20 s the line dims to ink-3 in 240 ms so the screen stops asking for attention; it returns to ink with the next line.
- 跳过这一处 jumps to the next section; the engine moves the rest of the timeline earlier and the remaining time drops accordingly.

**8.15.8 Focus** (player-focus.png). Under the HUD, 8 apart: the **FocusTimeline**, full column width; the **guide line** 32 below (reading 17 / 28 ink-2, at least 56 high, phrase-wrapped, `aria-live="polite"`); the **回神 key** fills the rest of the stage (at least 240 high; 24 above, 16 below); then the readout 剩余 and the controls, as in every player.
- FocusTimeline: past baseline 1.5 px ink-2; future dotted 1.5 px `--line` (dash 0.5 / 5, round caps); a 2 px ink tick, 16 high, at each 回神; minute ticks below the baseline (3 px, 5 px every 5 minutes, `--line` / ink-3); labels micro ink-3 at 0, 5, 10 and the end (「15 分钟」); now-dot 8 px `--now`. In the summary the whole session is past.
- 回神 key `.huishen-key`: a button, full width, radius 8, `--paper-raised`, **inset 1 px `--line`** (3.11 : 1 on raised — the key's extent is visible; the old `--rule` edge at 1.29 : 1 made it a dark card with no edge); label 回神 display 600 24 / 32 tracking 0.24em, centred; the hint under it, caption ink-3, chosen by input (§10.2): touch 「也可以轻点屏幕的任何地方」 (PLAYER.focus.markHintTouch), fine pointer 「也可以按 [空格]」 (PLAYER.focus.markHintKeys, with `.kbd`). Press: `--wash-2` for 100 ms, a tick drops onto the timeline, optional 操作提示音, 15 ms haptic. No count animation, no praise. The whole stage area below the timeline also accepts taps; Space works anywhere. Presses within 600 ms of the last are ignored.

**8.15.9 Count** (数息; no mock-up). No numbers during practice (PRODUCT.md §5). Stage: the hint PLAYER.count.hint (caption ink-3) for the first two rounds, then removed; the **count pad**: two keys side by side, 12 apart, filling the stage (at least 280 high), styled like the 回神 key — the left key 「1–8」 two thirds of the width, the right key 「9」 one third (the left one is pressed eight times as often); each key's label Inter 300 32 / 40 tabular, centred, with a caption ink-3 below (「第 1–8 口气」「第 9 口气」), edge 1 px `--line` like the 回神 key; under the pad, 12 apart, 「数乱了」 as a secondary block button 48 high. Press: `--wash-2` 100 ms + 15 ms haptic; no visible count; a cue sound only if 操作提示音 is on. Keys: F or ← = 1–8, J or → = 9, Backspace = 数乱了.

**8.15.10 Timer** (静坐计时; no mock-up). Stage: remaining time t-count (Inter 300 64 / 64 tabular) left-aligned; under it, 16 apart, a progress line: hairline track, 2 px ink for the elapsed part, 6 px ticks in `--line` at each interval bell (ink once rung); caption ink-3 under it: 「间隔钟声 · 每 5 分钟」 or 「没有间隔钟声」. Readouts: 已坐 · 下次钟声 (「—」 when none).

**8.15.11 Sound** (听声音 · 放松 / 睡前; no mock-up). Stage: the current sounds as a title (display 24 / 32: 「雨 + 长音」) with the caption 「放松」 or 「睡前」 above it; remaining time t-timer (32 / 40); a fade figure under it: a 2 px ink line at full level that slopes to zero over the last 60 s (放松) or 2 minutes (睡前, SOUND_COPY), with the now-dot; for 不限 the line never slopes and the remaining time reads 「不限时」. Sleep mode: after 30 s without interaction the stage dims to 50 % opacity (240 ms); any touch restores it. On iOS the first time: PLAYER.notices.iosLock as a caption under the HUD. Controls as in every player — 暂停 · 声音 · 不舒服 · 结束 on a phone held upright, the 不舒服？ chip in the HUD elsewhere (PRODUCT.md §5: always visible).

**8.15.12 Pace-finder run** (no mock-up). As the paced player, with the HUD meta 「第 2 档，共 5 档 · 6.0 次/分」 and no 有点急. After each 1-minute step, the curve holds and the rating sheet rises (it cannot be dismissed by the scrim): the question and a 1–5 one-tap scale (five cells, styled like `.scale`, with end anchors); a tap continues to the next step after 600 ms. Result: §13.11.

**8.15.13 Lead-in.** For the 开头倒数 seconds (default 5): paced players show 「准备」 in the phase style and the countdown figure (t-count 64) where 「3 秒后吸气」 normally sits; other players show the countdown figure at the top-left of the stage with 「准备」 in caption ink-3 above it. 暂停 works; 结束 during the lead-in ends without a record and without a dialog. The start bell sounds 3 s after the ambience begins (PRODUCT.md §5).

**8.15.14 Ending.** In the last 60 s the ambience fades over 30 s; the caption area (or, without captions, the space under the stage figure) shows PLAYER.silentEnding once in caption ink-3. After the end bell the stage stays for 3 s, then the summary opens (900 ms transition to the app theme). No 「完成！」, no animation.

**8.15.15 Controls** `.player-controls`. Equal buttons, 56 high (`--controls-h`); hairlines on top and bottom and between the buttons; icon 20 + label 15 / 24 ink, 6 apart: 暂停 (`i-pause`) ↔ 继续 (`i-play`), 声音 (`i-sound`), **不舒服 (`i-help`; phone held upright only, §8.15.3)**, 结束 (`i-end`). Four controls are 87.5 wide at 390; the visible label is 「不舒服」 (PLAYER.unwellShort) and the accessible name keeps 「不舒服？」. Pressed `--wash-2`; focus ring inset −4. 声音 opens the sound sheet: ambience list and music list (radio rows with sound icons), and three sliders 声景 · 音乐 · 提示音与钟声. 结束 opens the end dialog: title 「结束这次练习？」; body 「已练 6 分钟，会记在记录里。」 (≥ 60 s) or SUMMARY.notRecorded (< 60 s); actions 「继续练习」 (secondary) and 「结束」 (primary). Keys: Space = pause / resume (the focus player: Space = 回神, P = pause); Esc = pause and open the pause panel.

**8.15.16 Pause panel** (pause.png). A dark bottom sheet from 112 below the top (the dimmed HUD with 「 · 已暂停」 stays readable) that opens whenever the practice is paused — by 暂停, Esc, or an interruption such as losing audio focus. Title PLAYER.paused 「已暂停」; meta caption 「已练 03:45 · 还剩 06:15」 (`mm:ss`, §4.4); under a 1 px ink rule, the full stop guidance (PRODUCT.md §5), phrase-wrapped: STOP_GUIDANCE.title as a name-size heading; `when.lead` + its items (· list); `after.lead` + its items (numbered); the `breathing` paragraph (ink-2); the `emergency` line as in §8.15.17; a link-more 「求助方式 ›」; for a fine pointer only, the keyboard line PLAYER.pause.keys (caption ink-3). The body scrolls; sticky footer: 「继续」 (primary, ink-2 fill) · 「结束」 (secondary). Closing the sheet = 继续.

**8.15.17 不舒服？ sheet** (distress.png). Opening it pauses the practice. Dark sheet from 112 below the top, no close ×. It fits one 390 × 844 screen; at larger text the body scrolls and the footer stays (distress-200.png). Content, top to bottom:
1. Title PLAYER.unwell 「不舒服？」 (24 / 32).
2. 「练习已暂停。」 ink-2 followed by STOP_GUIDANCE.short in ink 600, phrase-wrapped.
3. STOP_GUIDANCE.after.lead 「停下以后：」 with 「停止指引全文 ›」 (caption link-more to `/help#stop`) on the same line; the first three `after` items in content order (「头晕的话，先坐下或躺下，缓过来再起身。」 first) as a 1-2-3 list, ink-2, phrase-wrapped — no item ends on a two-character line.
4. Under a hairline, **the emergency line** STOP_GUIDANCE.emergency at body 15 / 24 in **ink** — the most urgent sentence on the sheet is never its smallest or dimmest — phrase-wrapped, with 「120」 a `tel:120` link (Inter 600, underlined in ink).
5. 「60 秒落地练习」 (STOP_GUIDANCE.actions.grounding) primary block button, 16 below (ink-2 fill on the player surface). It ends the current session (recorded if ≥ 60 s) and opens the grounding player; afterwards the summary asks only 练完感觉.
6. 求助方式: section head with 「求助方式 ›」 (display 17, links to `/help`) on the left and 「最后核实：2026-10-22」 caption ink-3 on the right; then the **dial grid** (§8.17).
7. Sticky footer, two equal columns: **「结束练习」** (secondary, left) and **「继续」** (quiet, right; 48 high in this footer). The person opened this sheet because they feel unwell: ending is the expected action, continuing the quiet one.

- **结束练习** ends the practice at once — **no end dialog**. The session is recorded if it lasted ≥ 60 s (otherwise it is dropped without a message); the summary opens and asks **only 练完感觉** (no 0–10 question, no gentler-suggestion delay); 很不舒服 there opens 先休息一下 as usual.
- **继续** closes the sheet and resumes after the lead-in countdown (§8.15.13), so the person is not dropped mid-phase.
- Closing by scrim, Esc or drag keeps the practice paused — it never resumes by itself — and shows the pause panel.
- Targets: the stop-guidance link, the 120 link, 落地练习, the 求助方式 link, four dial cells and the two footer buttons — ten, none within 8 px of another.

**8.15.18 Landscape phone, tablet and desktop** (player-breath-landscape.png; `components.css`). **Landscape phone** (height < 500): two columns — the stage in the left 55 % (phase row and curve, or the key, pad or caption; the curve 150 high, bleeding into the left safe area), the HUD, readouts and controls in the right 45 % (HUD at the top, readouts and controls at the bottom); the HUD carries the 不舒服？ chip and the controls are three. **Tablet and desktop**: HUD, stage, readouts and controls sit in a 640 column centred in the window — the one centred layout in the product, because a player is a single instrument; the breath curve spans the window; the HUD carries the chip. Sheets inside a player: bottom sheets at most 560 wide on tablet, a 420 right-hand panel on desktop (§8.13).

### 8.16 One-tap choices and text field

- **练完感觉** `.choice`: four equal cells in one group with an inset 1 px line, radius 4, 48 high, 1 px `--rule` separators; label 15 ink; selected: ink fill, `--on-ink`, 600. `role="radiogroup"`; no preselection; one tap commits (no confirm). 「跳过」 as a quiet link on the right of the question (44 target). 很不舒服 immediately opens the 先休息一下 sheet (§13.6).
- **此刻有多紧张？** `.scale` (summary.png): eleven cells 0–10 in **two rows on one 58 px pitch — 0–5, then 6–10, left-aligned**, so each column reads n / n + 6 and every cell is 57 × 48 (≥ 44 × 44; the one-row version was 31.8 px wide); cells share 1 px `--line` edges, the four outer corners of the shape radius 4; figures Inter 15 tabular ink; selected: ink fill, `--on-ink`, 600. The anchors are one caption line under the grid, ink-3: 「0 一点也不 · 10 非常紧张」 (SUMMARY.checkin.low / .high, the figures in Inter) — unambiguous wherever the grid breaks. No preselection; the before-score is never shown when asking after (PRODUCT.md §6); 「跳过」 link. The same component with five cells in one row (5 × 58) serves the 1–5 ratings: the pace-finder step and 每周压力自评.
- Question titles above both: display 17 / 24 (`.t-name`), 32 above, 8 below.
- **备注**: the text field (§8.8) under the heading 「备注」 (display 17); placeholder SUMMARY.note.placeholder.

### 8.17 Help numbers

- **PhoneRow** `.phone-row` (on `/help` and in 设置 › 安全): at least 60 high; left: the name 15 600 and the description caption ink-3 (with its hours: 「24 小时」); right: the number Inter 17 tabular ink + `i-phone` 20 ink-2; the whole row is `<a href="tel:…">` with `aria-label="心理援助热线 12356，拨打"`; hairlines between rows. Grouped by region (CRISIS_RESOURCES order: 中国大陆 first, 其他地区 last) under group titles.
- **DialGrid** (in the 不舒服？ and 先休息一下 sheets): the four mainland numbers — 心理援助热线 12356 · 希望24热线 400-161-9995 · 急救 120 · 报警 110 — in a ruled 2 × 2: a vertical hairline between the columns, a hairline between the rows, no outer box; each cell a `tel:` link at least 64 high: the name caption ink-3 above the number Inter 17 tabular ink + `i-phone` 16 ink-3; 16 left padding in the right column; focus ring outside the cell (offset 2 — the left column has no padding, an inset ring would cut the label; states.png).
- **Emergency line** `.emergency` (不舒服？, 已暂停, `/help`): STOP_GUIDANCE.emergency at body size in ink, phrase-wrapped, the number a `tel:` link (§3.5).
- Always bundled (offline), numbers tappable, 「最后核实：2026-10-22」 (LAST_VERIFIED) always next to them.
- **Reachability** (PRODUCT.md §10: two steps from anywhere). Every page without a tab bar carries its own route, and the build fails a mock-up that has none (§14.4):

| Where | Route | Taps until the numbers are on screen |
| --- | --- | --- |
| players | 不舒服 (control or chip) → the sheet's dial grid | 1 |
| 今日 | 现在有点难 row → the sheet's dial grid | 1 |
| other tab roots, pushed pages without a dock | the 今日 tab → 现在有点难 | 2 |
| practice detail (docked) | 「求助方式 ›」 at the end of 安全 → `/help` | 1 |
| summary | 「求助方式 ›」 at the end of the page, or in the gentler block when it shows; 很不舒服 opens 先休息一下 with the dial grid | 1 |
| 开始之前, 设置 › 安全 | 「查看求助方式 ›」 / the 求助方式 row → `/help` | 1 |
| tablet, desktop | the rail's 求助方式 | 1 |

### 8.18 Table (desktop 记录)

`table-layout: fixed` with a `colgroup` (records-desktop.html: 128 · 64 · 120 · 72 · 232 · 88 · 64 · 64 · auto · 96). Head cells caption ink-3 400 over a 1 px ink rule; body cells 44 high, hairline below, `white-space: nowrap`; numeric columns right-aligned and tabular; a text column that follows a numeric one gets 24 left padding; long text (记录, 备注) truncates with … and the full text is in the session detail; empty values 「—」 ink-3. Row hover (fine pointer) `--wash` and reveals 「详情」「删除」 (quiet links); they are also revealed on the row that holds keyboard focus (`:focus-within`). A row is a link (Enter opens the detail); Delete on a focused row opens the delete dialog. 练完感觉 values, 更紧张 and 很不舒服 included, are plain ink text like every other value (records-desktop-full.png). Newest first; 50 rows, then 「显示更早的 50 条」 (quiet button). No sorting in v1.

### 8.19 Small parts

- **Disclosure** `.disclose`: ink-2 label + `i-chevron-down` 16 ink-3, 44 high; `aria-expanded`, `aria-controls`; the chevron turns 180° in 240 ms.
- **Filter**: the filter row (§8.8), a radio group that filters the list under it — 练习: 全部 · 冥想 · 呼吸 · 声音; 依据: 全部 · 冥想 · 呼吸 · 声音 · 安全. The choice persists for the session (`sessionStorage`) and is 全部 after a cold start.
- **Programme row**: a practice row with the programme glyph; description 「进行中 · 第 3 周第 2 天」 while in progress, otherwise the programme's one-line plan (「节律逐周放慢，每天 5–10 分钟」); end 「8 周」.
- **Text helpers** `.clause` (phrase wrapping) and `.keep` (the last four characters, `white-space: nowrap`) — §4.3.
- **Tag** `.tag` (「自评」): caption ink-2, padding 0 6, radius 2, inset 1 px line.
- **Kbd** `.kbd`: 20 high, padding 0 6, radius 2, inset line plus a bottom line, micro ink-2.

---

## 9. Iconography

- Grid 24 × 24, live area 20 × 20 (2 px padding); stroke 1.5; round caps and joins; rectangle corners 0.5–0.75; `currentColor` only. Fills appear only in the `-on` tab variants and as solid dots inside `i-info`, `i-help`, `i-calendar` and `i-records` (the practised days).
- **Reserved shapes.** A square inside a square is the 回 seal and nothing else; a lone square is 结束 (`i-end`) and nothing else. An icon never borrows another meaning: no bar chart for 记录 (no minute bars, no scores), no sliders for 设置 (练习 has a real filter).
- Sizes: 24 (tabs, rail, icon buttons) · 20 (buttons, start bar, player controls, phone rows) · 18 (chips, quiet buttons) · 16 (row chevrons, link-more, dial grid, disclosure) · 14 (external link in citations). Back chevrons take −2 px right margin for optical alignment.
- Colour: inherited from the text (ink, ink-2, ink-3). Never cinnabar — the seal is a mark, not an icon.
- Every icon is either next to a text label (and `aria-hidden`) or inside an `.icon-btn` with `aria-label`. No icon before section headings. No emoji, no third-party icon sets. A new icon is drawn on this grid and reviewed by design.

Sprite (`icons.svg`, 51 symbols):

| Group | Symbol → use |
| --- | --- |
| Tabs | `i-today` / `i-today-on` 今日 (a sunrise: the half sun on the horizon with three short rays — 旦, 日 over the horizon; `-on` fills the sun) · `i-practice` / `-on` 练习 (one breath curve) · `i-records` / `-on` 记录 (a month leaf: header rule and five practised days as dots, one day left empty; `-on` fills the header) · `i-evidence` / `-on` 依据 (an open book) |
| Navigation | `i-back` back link, previous month · `i-chevron-right` navigation rows, link-more, next month · `i-chevron-down` disclosure · `i-close` sheet close, summary close · `i-settings` 设置 (a gear, eight teeth) · `i-help` 求助方式 and the 不舒服 control and chip · `i-search` (reserved, unused in v1) |
| Player | `i-play` 开始, 继续 · `i-pause` 暂停 · `i-end` 结束 · `i-skip` 跳过这一处 · `i-sound` / `i-sound-off` 声音, muted · `i-mark` 回神 (a tick on a baseline; used in the keyboard help and the 回神 row of records) |
| Actions | `i-refresh` 换一个 · `i-plus` / `i-minus` stepper · `i-check` completed programme weeks, selected list rows · `i-edit` 备注 edit · `i-trash` delete · `i-download` 导出 · `i-upload` 导入 · `i-calendar` 生成日历文件 · `i-external` DOI and external links · `i-phone` tel: links · `i-info` errors and notices |
| Settings | `i-sun` 浅色 · `i-moon` 深色 · `i-theme-auto` 跟随系统 · `i-bell` 钟声 · `i-timer` 静坐计时, 开头倒数 · `i-heart-rate` 心率 · `i-bluetooth` 心率带 (实验) |
| Sounds | `i-rain` 雨 · `i-stream` 溪流 · `i-wave` 海浪 · `i-forest` 林间 · `i-bird` 鸟鸣 · `i-wind` 风 · `i-noise` 粉噪声, 棕噪声 · `i-music` 长音, 五声, 回响 · `i-sleep` 睡前 · `i-breath` breathing (settings groups, rare) |

---

## 10. Copy and tone

### 10.1 Voice and conventions

Copy lives in `src/content/*` (copy.ts, safety.ts, practices.ts, sounds.ts, scripts, programmes). Components never contain Chinese sentences of their own; the strings this document introduces are listed in §14.3 for the content owner. The voice is a calm, precise teacher who has read the research: 你称, short sentences, full-width punctuation, a space between Chinese and figures or Latin, no exclamation marks, no emoji, no superlatives, no empty encouragement, probability tied to evidence, fixed terminology (PRODUCT.md §11).

| Don't | Do | Rule |
| --- | --- | --- |
| 太棒了！你已经连续练习 7 天！ | 练了 10 分钟 | no praise, no streaks |
| 您今天想练什么？ | 晚上 · 身体扫描 | 你称; say it, don't ask it (TODAY.slots) |
| 你已经 5 天没有练习了 | 欢迎回来。先做 1 分钟？ | never count missed days (TODAY.welcomeBack) |
| 恭喜完成今日目标 | 今天的计划练完了。 | no goals language (TODAY.program.doneToday) |
| 科学证明能减压 | 与不练习相比，压力平均小幅减轻（证据：中等） | claims name the comparison and the grade |
| 开启你的疗愈之旅 | 先练 1 分钟 | forbidden words (PRODUCT.md §10) |
| 正念分数 92 分 | 准确率 83% · 数乱了 1 次 | no scores |
| 走神 11 次，专注力有待提高 | 回神 11 次。次数多少没有好坏。 | neutral about 回神 |
| 深呼吸，越深越好 | 轻柔地呼吸，不必吸得很深。 | safety wording (BREATH_OPENING_LINE) |
| 5分钟 · 5 mins · 5min | 5 分钟 | space, Chinese unit |
| 静观 · 冥想练习 · 呼吸训练 | 正念 · 专注呼吸 · 慢呼吸 | fixed terms |
| 点击这里开始 | 开始 | buttons are verbs |
| 出错了！请稍后重试 | 这个文件无法导入。只支持回神导出的 JSON 文件。 | say what happened and what to do |
| 确定要删除吗？ | 删除这条记录？删除后无法恢复。 | state the consequence |
| 加油，坚持就是胜利 | (nothing) | no empty encouragement |
| “提醒” | 「提醒」 | Chinese quotes |
| 10/22 · 2026-10-22 周四 · 2026 年 10 月 | 10月22日 星期四 · 2026年10月 | dates are calendar references, written solid (§4.4); ISO only in 最后核实 |
| 已是最快的 6.5 次/分 | 已到上限：6.5 次/分 | no superlatives (PRODUCT.md §11) |
| 也可以轻点屏幕，或按 空格 (on a phone) | 也可以轻点屏幕的任何地方 | name the input the person has (§10.2) |
| 放松效果提升 30% | (never) | no invented numbers |

Conventions: buttons ≤ 4 characters where possible (开始 · 继续 · 结束 · 完成 · 跳过 · 展开 · 换一个; 「结束练习」 in the 不舒服？ sheet, where 结束 alone could mean closing the sheet); headings are nouns (练习 · 记录 · 依据 · 本周 · 只有几分钟); questions end in ？ (练完感觉怎么样？ · 此刻有多紧张？); an error never blames the user; a confirmation states what will happen; a number always carries its unit. Mock-ups print `src/content` strings verbatim; a string content does not have yet is listed in `content.mjs` → `NEW` and in §14.3.

### 10.2 Copy that names an input

Copy that names a gesture or a key exists in two forms, and each shows only where it applies, chosen by `@media (hover: hover) and (pointer: fine)` (mouse, trackpad) and its exact complement `(hover: none), (pointer: coarse), (pointer: none)` (touch, pen, no pointer). In markup: `data-modality="touch"` or `data-modality="fine"`; `base.css` hides the one that does not apply. Never a keyboard instruction on a touch screen; never 「轻点屏幕」 under a mouse. A device with both (a touch laptop) matches the fine form; tapping still works there.

| Where | Touch | Fine pointer |
| --- | --- | --- |
| 回神 key | PLAYER.focus.markHintTouch 「也可以轻点屏幕的任何地方」 | PLAYER.focus.markHintKeys 「也可以按」 + `.kbd` 空格 |
| pause panel | — | PLAYER.pause.keys 「键盘：空格继续练习，Esc 关闭面板并继续。」 |
| count pad | — | the key line 「也可以按 F 或 ← 记 1–8，J 或 → 记 9，退格键是数乱了。」 |
| 记录 table (desktop) | — | 「点一行看详情」 |

---

## 11. Accessibility (WCAG 2.2 AA)

- **Contrast** (§3, measured): every text token ≥ 4.5 : 1 on every ground it is used on (the lowest: ink-3 on `--paper-sunk` 4.69 light, ink-3 on `--paper-raised` 5.08 dark, `--on-ink-2` on the dark primary fill 5.07); control boundaries in `--line` ≥ 3 : 1 (lowest 3.11, dark on raised); the focus ring ≥ 14 : 1. `--rule` hairlines are decorative and never the only boundary of a control.
- **Selected and current states ≥ 3 : 1** (1.4.11). A selected option is an ink fill — segments, choice cells, 0–10 cells, the on toggle: 15.55 : 1 against the paper of its neighbours (light), 15.32 (dark). The current filter option carries a 2 px ink rule (15.55); the current tab and rail item carry the filled `-on` icon and the 600 ink label (the rail's `--paper-sunk` well is supplementary: 1.13 light, 1.05 dark). The edges of the 回神 key and the count-pad keys are 1 px `--line` (3.11 : 1 on raised, dark). A state is never carried by a shadow or by `--rule`.
- **Focus**: `:focus-visible` = 2 px solid `--focus` (ink), offset 2. Inset (−2, −4) only where the target fills its container edge to edge: tabs, player controls, filter options. Outside (offset 2, above the neighbours) on cells of a group and on dial cells — an inset ring vanishes on an ink fill or cuts an unpadded label. Never removed without a replacement. **states.png** forces the real `:focus-visible` style on every component in light and dark (the build uses `CSS.forcePseudoState`); review it with every change to `components.css`.
- **Focus never hides under a bar** (2.4.11). `base.css` sets `scroll-padding-top: safe-top + 8` on `<html>` and `scroll-padding-bottom` by the `data-bars` attribute PageFrame puts on `<html>`: `tabs` (default) tab bar 49 + safe-bottom + 8; `dock` 80 + safe-bottom + 8; `player` controls 56 + safe-bottom + 16; `none` safe-bottom + 8; on tablet and desktop 8, except docked pages on tablet. Sheet bodies scroll inside the sheet and their footers sit outside the scrolling box. **Test** (Playwright, phone viewport): tab through 练习详情 and assert for every focused element `rect.bottom ≤ dock.top`; tab through 今日 and assert the same against the tab bar; tab through the 不舒服？ sheet at 200 % text and assert every target is visible above the footer.
- **Targets**: every interactive element has a hit area of at least 44 × 44 (stricter than 2.5.8) — including each 0–10 cell (57 × 48) and each filter option (≥ 46 × 44). Visually smaller controls extend their hit area with `::before`: chips 36, small buttons 36, DOI links 24. Inline links inside sentences are exempt (2.5.8 inline), including the 120 in the emergency line, whose number is also a 64 px cell in the dial grid.
- **Text size**: type tokens are rem, so the browser's default-font-size preference scales all reading and UI text (§4.2); instrument figures, the phase word and figure labels keep their px size. Test the 不舒服？ sheet, the pause panel and 开始之前 at 200 % text: the body scrolls first, the head and footer stay, nothing is clipped, the dial grid is reachable by scrolling (distress-200.png). Reflow at 320 CSS px and at 200 % and 400 % zoom without horizontal scrolling (the desktop table scrolls inside its own section); no fixed heights on text containers (min-height only), so 1.4.12 text-spacing overrides never clip.
- **Keyboard**: everything operable; DOM order = visual order; roving tabindex in radio groups; Esc closes sheets and dialogs; a 「跳到正文」 skip link is the first focusable element on desktop. Player keys (only while the player has focus and no field is focused): Space = 回神 (focus) or pause / resume (others); P = pause (focus); F / ← = 1–8, J / → = 9, Backspace = 数乱了 (count); Esc = pause panel. Copy that names a key shows only to fine pointers (§10.2).
- **Structure**: landmarks — `header`, `nav aria-label="主导航"`, `main`, and in players `nav aria-label="练习控制"`; one h1 per page and a `document.title` per route (§13.1); on every route change focus moves to the h1 (`tabindex="-1"`); headings in order; lists are lists; tables have header cells.
- **Players — names and roles**:

| Element | Semantics |
| --- | --- |
| player root | `<main aria-label="慢呼吸练习">` (practice name + 练习) |
| phase word, 「3 秒后吸气」 | `aria-hidden="true"` — the audio cue carries the rhythm |
| breath curve / box pacer canvas | `aria-hidden="true"`; a sibling `.vh` sentence describes the pattern: 「跟着节拍呼吸：吸 4.5 秒，呼 6.5 秒，每分钟 5.5 次。」 (`describePattern`), updated only when the rate changes |
| readouts | plain text, not live; reachable by reading |
| 有点急 | button 「有点急」, `aria-describedby` → PLAYER.paced.hurryHelp |
| 回神 key | button 「回神」, `aria-describedby` → PLAYER.focus.markHelp; nothing is announced after a press |
| focus timeline | `role="img"`, label 「回神 7 次，分别在 1 分 36 秒、……」, refreshed when it receives focus, not live |
| count pad | buttons 「第 1 到第 8 口气」「第 9 口气」「数乱了，从 1 重新数」 |
| guided caption, focus guide line | `aria-live="polite"` — the only live regions in a player |
| step chart / section strip | `role="img"`, 「身体扫描进度：现在是胸口、后背和肩膀，第 4 处，共 6 处」 |
| 跳过这一处 | button, `aria-describedby` → PLAYER.guided.skipHelp |
| 不舒服 (control or chip) | button, accessible name 「不舒服？」, `aria-haspopup="dialog"` |
| controls | buttons 暂停 / 继续, 声音, 不舒服 (phone upright), 结束 inside `nav aria-label="练习控制"` |

- **Live regions**: in players, only the captions; outside players, only the toast (`role="status"`). Never live: phase words, countdowns, timers, counters, rates.
- **Motion**: §7.3; nothing flashes (2.3.1); all animation stops while paused.
- **Forms**: visible labels (the 备注 heading is its label); errors per §3.5 with `aria-describedby`.
- **Audio and time**: guided practices always show the spoken text as captions; nothing relies on sound alone (curve, phase word, haptics); no time limits in the UI; toasts with actions last 6 s and pause on hover or focus.
- **Language**: `lang="zh-CN"`; English names (journals, DOIs, author lists) in `lang="en"`.
- **Testing**: axe-core in component tests; the focus-under-bar test above; manual passes with VoiceOver (iOS Safari) and TalkBack (Chrome) on the four players and the 不舒服？ sheet; a keyboard-only pass on desktop against states.png.

---

## 12. Implementation (React 19 + CSS Modules)

### 12.1 Files

- `src/ui/tokens.css` and `src/ui/base.css` — from `docs/design/final/tokens.css` (§2), unchanged.
- `src/ui/components/<Name>/<Name>.tsx`, `<Name>.module.css`, `<Name>.test.tsx` — one folder per component in §12.3.
- `src/ui/figures/*.ts` — pure geometry functions ported from `draw.mjs` and `charts.mjs` (paths and points, no DOM), with unit tests.
- `src/ui/text.ts` — `bindUnits()` (§4.4), `keep()` and `clauses()` (§4.3). The mock-up build has the reference implementations (`src/build.mjs` → `bindUnits`, `src/content.mjs` → `keep`, `clauses`).
- `src/ui/icons.tsx` — `<Icon name size>` over `public/icons.svg`.
- `src/ui/index.ts` — barrel.
- `public/fonts/*.woff2` (+ `.chars.txt`), `public/icons.svg`.

### 12.2 CSS Module rules

- Only `var(--…)` tokens for colour, type, space, radius, shadow, motion and layers. No hex values and no unlisted sizes in modules; px values that are not tokens must appear in this document or in `components.css`.
- States through ARIA and native attributes in selectors — `[aria-checked="true"]`, `[aria-current="page"]`, `[aria-expanded="true"]`, `[aria-pressed="true"]`, `:disabled`, `:focus-visible` — and `data-state` only where ARIA has nothing (`data-pressed` for touch feedback). No `.is-active` classes.
- Type roles come from the global classes in `base.css` via `composes: t-caption from global;`.
- No inline styles except geometry computed at runtime (SVG and canvas).

### 12.3 Component map

| `components.css` block | React component | Main props | Notes |
| --- | --- | --- | --- |
| `.page`, `.page--dock`, `.page--bare` | `PageFrame` | `variant: 'tabs' \| 'dock' \| 'bare'`, `title` | app shell; sets `data-bars` on `<html>` (§11) and `document.title` (§13.1) |
| `.masthead`, `.lockup`, `.dateline` | `Masthead`, `Lockup`, `Dateline` | `date`, `solarTerm` | 今日 only |
| page head + folio (§8.0) | `PageHead` | `title`, `folioStart`, `folioEnd`, `actions?` | 练习, 记录, 依据 |
| `.navbar`, `.back` | `NavBar` | `backTo`, `backLabel`, `actions?` | |
| `.kicker`, `.lead`, `.unit` | `Kicker`, `Lead`, `Unit` | | |
| `.section`, `.section-head` | `Section` | `title`, `aside?`, `level = 2` | |
| `.btn` + variants | `Button` | `variant: 'primary' \| 'secondary' \| 'quiet' \| 'danger'`, `size: 'md' \| 'sm'`, `block`, `long`, `icon?`, `as?: 'button' \| 'a'` | |
| `.icon-btn` | `IconButton` | `icon`, `label` (required) | |
| `.link-more` | `LinkMore` | `to` | |
| `.startbar`, `.dock` | `StartBar`, `Dock` | `minutes`, `to` / `onStart` | |
| `.grade` | `GradeMark` | `grade: Grade \| null`, `prefix?: boolean` | renders nothing for `null` |
| `.prow`, `.prow--nav`, `.glyph` | `PracticeRow`, `BreathGlyph` | `practice`, `end: 'duration' \| 'weeks' \| 'chevron'`, `minutes`, `showGrade` (catalogue), `variant: 'practice' \| 'nav'` | `BreathGlyph id` from §8.6 |
| `.group-title`, `.list`, `.row…` | `ListGroup`, `NavRow`, `ToggleRow`, `StackRow`, `DisclosureRow` | | |
| `.seg` | `Segmented` | `options`, `value`, `onChange`, `label` | radio group, roving tabindex; ink-filled selection |
| `.filter` | `FilterRow` | `options`, `value`, `onChange`, `label` | radio group; reserves the 600 width of each label |
| `.slider` | `Slider` | `min`, `max`, `step`, `majorStep`, `value`, `valueText(v)`, `scale` | |
| `.toggle` | `Toggle` | `checked`, `onChange`, `labelledBy` | `role="switch"` |
| `.stepper` | `Stepper` | `values` or `min`/`max`/`step`, `value`, `format` | |
| `.field` | `TextField` | `label`, `placeholder`, `maxLength`, `error?` | |
| `.weekdots` | `WeekDots` | `days: { date, minutes, state }[]`, `size: 'phone' \| 'desk'` | no mark for days without practice |
| `.cal` | `MonthCalendar` | `year`, `month`, `practised: Set<string>`, `today` | |
| `.dotplot` | `DotPlot` | `points`, `from`, `to` | |
| (§8.9) | `Sparkline` | `values`, `domain` | |
| `.countrows` | `CountRows` | `rows` | |
| `.checkins` | `CheckinStrips` | `before`, `after` | |
| `.pbars` | `PracticeBars` | `rows` | |
| `.stepchart` | `StepChart` | `sections`, `duration`, `now?`, `step`, `axis` | `SectionStrip` = `step={0}` |
| `.warmup` | `BreathSpecimen` | `params`, `cycles = 3` | |
| `.breathcurve` | `BreathCurve` (canvas) | `session`, `pattern` | reduced-motion mode |
| (§8.15.6) | `BoxPacer` (canvas) | `session`, `pattern` | |
| `.ftl` | `FocusTimeline` | `minutes`, `marks`, `t?` | |
| `.ci` | `EffectRows` | `outcomes: { name, k?, n?, g, lo, hi }[]`, `domain` | |
| `.steps` | `Steps` | `items` | |
| `.claims` | `Claims` | `claims: { claim, grade, cites }[]` | one graded result per line (§8.10) |
| `.overview` | `Overview` | `cells` | 记录 key figures |
| `.cite`, `.note` | `Cite`, `Notes` | | |
| `.ecard` | `EvidenceCard` | `card`, `expanded`, `onToggle` | fields per PRODUCT.md §9; no certainty field |
| `.tabbar`, `.tab` | `TabBar` | `current` | app shell |
| `.rail` | `NavRail` | `current`, `compact` | app shell |
| `.scrim`, `.sheet` | `Sheet` | `open`, `onClose`, `title`, `footer?`, `dismissible = true` | focus trap, inert, scroll lock |
| `.dialog` | `Dialog`, `ConfirmDialog` | `title`, `body`, `confirmLabel`, `tone: 'default' \| 'danger'` | |
| `.toast` | `ToastHost`, `useToast()` | `message`, `action?` | `role="status"` |
| `.empty` | `EmptyState` | `title`, `body`, `action?` | |
| `.player`, `.hud` | `PlayerFrame`, `PlayerHud` | `name`, `meta`, `onUnwell` | sets `data-theme="dark"` and `data-surface="player"`; the HUD renders the 不舒服？ chip, which CSS shows only on tablet, desktop and landscape |
| `.chip` | `Chip` | `variant: 'default' \| 'quiet' \| 'unwell'`, `icon?` | `unwell`: 44 visible, `i-help` |
| `.readouts` | `Readouts` | `items: { label, value, unit? }[]` | |
| `.phase` | `PhaseWord` | `phase`, `secondsLeft`, `next` | `aria-hidden` |
| `.player-controls` | `PlayerControls` | `paused`, `onPause`, `onSound`, `onUnwell`, `onEnd` | renders 不舒服 with `data-control="unwell"`; CSS hides it where the HUD chip shows |
| `.huishen-key` | `HuishenKey` | `onMark` | both hints rendered with `data-modality`; CSS shows one (§10.2) |
| (§8.15.9) | `CountPad` | `onBreath`, `onNinth`, `onReset` | |
| (§8.15.7) | `GuidedCaption` | `text` | `clauses()`, `aria-live` |
| `.choice`, `.scale` | `ChoiceGroup`, `ScaleGroup` | `options` / `min`, `max`, `anchors`, `value`, `onChange` | radio groups; ScaleGroup lays 0–10 out in two rows of six columns, 1–5 in one row |
| `.phone-row` | `PhoneRow` | `line: CrisisLine` | |
| (§8.17) | `DialGrid` | `lines` | |
| `.table` | `SessionsTable` | `sessions` | desktop |
| `.kbd`, `.tag` | `Kbd`, `Tag` | | |
| `.emergency`, `.stoplist` | `EmergencyLine`, `StopList` | `text` / `items` | phrase-wrapped; numbers become `tel:` links |
| `.clause`, `.keep` | (text helpers) | | §4.3 |
| (§8.19) | `Disclosure` | `expanded`, `controls` | |

### 12.4 Figures

Port `draw.mjs` and `charts.mjs` to `src/ui/figures/` as pure functions that return geometry; components render SVG (or canvas) from it. Use the engine (`buildPattern`, `withWarmup`, `patternAt`, `describePattern`) instead of the mock-up's re-implementation of the patterns, and `buildTimeline()` for section timings (the mock-up's `BODY_SCAN_10` is a snapshot of it from 2026-10-23). Tests assert key coordinates against the mock-up output (week dot centres, step-chart tread positions for the 10-minute body scan, the focus timeline's tick x for known marks).

### 12.5 Runtime

- `ThemeProvider` sets or removes `data-theme` on `<html>` from the 外观 preference and keeps `meta[name=theme-color]` in sync; `PlayerFrame` sets `data-theme="dark"` on its root.
- `usePrefersReducedMotion()`; `useCssVar(name)` (re-read on theme change) for canvas colours.
- Fonts: `scripts/fonts.config.json` (§4.1), `npm run fonts`, `src/ui/fonts.test.ts`.
- A dev-only catalogue (`ui-kit.html`) renders every component in every state, light and dark side by side, with the keyboard states forced the way `states.html` does; screenshots at 390 × 844 @2 and 1440 × 900 are compared with the final PNGs — sizes, weights, hairlines, spacing and icon weight must match.
- PageFrame owns the page-level attributes: `data-bars` on `<html>` (§11) and `document.title` (§13.1). Input-modality copy needs no script: both forms render and CSS shows one (§10.2).

---

## 13. Screen recipes

> **v1 has no spoken guidance** (PRODUCT.md §0, decided 2026-10-23): guided practices are text-guided. In guided players the caption is the primary element of the screen (largest reading size the layout allows, centred column, generous line-height); it stays until the next line and fades to the secondary ink a few seconds after its reading time; a very soft cue sounds when a new line appears after ≥ 20 s of silence (setting, default on). 正念行走 and 睡前身体扫描 are not offered in v1. Ignore any voice / 朗读 / 语速 references elsewhere in this document.

Every route in PRODUCT.md §1. A recipe lists the regions top to bottom, the component for each and where its copy comes from, then states and the desktop layout. Where a mock-up exists, it is the reference and the recipe covers what it does not show. Copy keys refer to `src/content/copy.ts` unless another file is named; strings marked *(new)* are requested in §14.3.

### 13.1 App frame

- **Phone**: tab roots = `.page` + tab bar. Pushed pages = navbar + content; the tab bar stays, except on docked pages, in players, the summary, the welcome flow and pace-finder runs. Back restores the previous scroll position; a new page starts at the top. Focus moves to the h1 on every route change.
- **Tablet**: compact rail (§5.4). **Desktop**: rail (§5.5) + content; route → current rail item per §8.12. Implemented in `components.css` (`.app`, `.rail`, `.tabbar`).
- No offline indicator: the app is offline-first. Storage problems are shown where data is (§13.14).
- **h1 and title per route** (one h1 per page; focus lands on it; `document.title` set by PageFrame):

| Route | h1 | `document.title` |
| --- | --- | --- |
| `/` | 「今日」, visually hidden, at every breakpoint (the recommendation is an h2 styled `.t-display`) | 今日 · 回神 |
| `/practices` | 练习 | 练习 · 回神 |
| `/practices/:id` | the practice name | 慢呼吸 · 回神 |
| `/play/:id` | the section title in guided players; elsewhere a visually hidden 「慢呼吸练习」 | 慢呼吸 · 回神 (unchanged during the practice) |
| summary | the practice name | 这次练习 · 回神 |
| `/records` | 记录 | 记录 · 回神 |
| `/evidence` | 依据 | 依据 · 回神 |
| `/settings`, sub-pages | 设置, or the sub-page name | 设置 · 回神 · 提醒 · 设置 · 回神 |
| `/program/:id` | the programme title | 八周正念 · 回神 |
| `/pace-finder` | 舒适节律探索 · 你的舒适节律 (result) | 舒适节律探索 · 回神 |
| `/welcome` | 回神 (the lockup's wordmark, as text) | 回神 |
| `/help` | 求助方式 | 求助方式 · 回神 |
| 404, error | 找不到这个页面 · 这个页面出了问题 | the same · 回神 |

### 13.2 今日 `/` — mock-up today.png

Phone, top to bottom:
1. **Masthead** — lockup, 设置 icon button.
2. **Dateline** — 「10月22日 星期四」 · solar-term phrase.
0. The page's **h1** is a visually hidden 「今日」 (TODAY.title) at every breakpoint; the practice name below is an h2 styled `.t-display`, so a route change announces the page, not a practice that 换一个 can replace.
3. **Recommendation** (`section`, 16 below the dateline): kicker (programme 「八周正念 · 第 3 周第 2 天」 via TODAY.program.day, or the time-slot label from TODAY.slots — 早上 · 午间 · 下午 · 晚上 · 夜里 — on the left; the grade mark with 「证据」 on the right); the practice name as h2 `.t-display` (32) with 「换一个」 (quiet button, `i-refresh`) on the right; a one- or two-line description (body ink-2; a `todayLine` per practice *(new)* — 「从左腿开始，一处一处往上，留意身体的感觉。可以躺着练，睡着了也没关系。」 is the model, and its first body word matches the first body tread of the figure; until it exists, `practice.short`); the practice's **figure**, 16 above and 20 below — body scan: StepChart 350 × step 5; other guided: SectionStrip; paced: BreathSpecimen (2 cycles, 96 high, no brackets); focus: an empty FocusTimeline for its duration with the caption 「每次回神，留一道竖线。」 *(new)*; count: the `breath-count` glyph at 4× (192 × 96); timer: the timer glyph at 4×; sound: the fade figure (§8.15.11); then the **start bar** with the minutes that will run.
4. **只有几分钟** — section head (h2 only, no link); three practice rows (end: duration): 一分钟停一停 1 · 三分钟呼吸空间 3 · 周期性叹息 5 (TODAY_CONTENT.QUICK_PICKS; the lightSlow row replaces 周期性叹息 when the health check says so). Descriptions are short structure lines (「停 · 吸 · 观 · 行」「觉察 · 集中 · 扩展」「鼻吸 · 补吸 · 长呼」) *(new)*; the longer hints are their `aria-describedby` text. Then **现在有点难** as a full-width navigation row (`.prow--nav`, §8.6): the `grounding` glyph, label TODAY.hard.title, hint TODAY.hard.rowHint 「周期性叹息 · 落地练习 · 求助电话」 *(new)*, chevron; it opens the 现在有点难 sheet. It is the most safety-relevant entry on the page, so it is a row with a hint — never a grey link in a section head.
5. **本周** — 24 below, hairline on top; left: 「本周」 caption ink-3 over TODAY.week.value 「3 天 · 46 分钟」 (17 / 24, figures proportional); right: WeekDots (phone size), bottom-aligned. On a 390 × 844 phone it sits just below the first screen.

States:
- **Back after ≥ 3 days** (PRODUCT.md §4.6): the kicker's left side becomes TODAY.welcomeBack 「欢迎回来。先做 1 分钟？」 in ink-2 and the recommendation becomes 一分钟停一停 (figure: its glyph at 4×; start bar 1 分钟). Never a count of days away.
- **Programme day done**: kicker TODAY.program.doneToday; under the title TODAY.program.next (caption); the recommendation falls back to the time-slot practice.
- **First day of a programme week**: TODAY.program.newWeek as the description, with 「本周说明 ›」 (link-more to the programme page).
- **换一个**: replaces the recommendation in place with the next alternative for the same slot (`today.ts`); no animation beyond a 180 ms opacity cross-fade of the block.
- **现在有点难 sheet**: title TODAY.hard.title; intro TODAY.hard.intro (ink-2); practice rows with glyphs — 周期性叹息 1 分钟 (or the light slow-breathing row), 三分钟呼吸空间 · 应对版 3 分钟, 落地练习 60 秒 (end 「60 秒」) — with the hints from TODAY.hard as descriptions; then the 求助方式 section head with 「最后核实：2026-10-22」 and the DialGrid.

Dark: today-dark.png — the same page; the start bar is the ink-2 slab (§3.2).

Desktop: no masthead (the rail carries the lockup). A 12-column grid: **columns 1–7**: the dateline, the recommendation with its figure at 7-column width and a 400-wide start bar; **columns 9–12**: 只有几分钟 (rows), 本周 (WeekDots desktop size), and 现在有点难 as an inline section (the same rows and the DialGrid, not a sheet).

### 13.3 练习 `/practices` — mock-up practices.png (+ -full)

Phone: page head 「练习」 + folio (「17 项练习」 · 「时长为默认值」 *(new)*); the filter row (全部 · 冥想 · 呼吸 · 声音, §8.8), 16 below; **计划** — section head with 「按完成的天数推进」 *(new)*, two programme rows (八周正念 8 周, 四周呼吸 4 周); then **冥想**, **呼吸**, **声音** sections in catalogue order (`catalogueSections()`), each with its count (「10 项」) and practice rows: the grade letter after the name, `practice.short` as the description, the default duration alone on the right; 声音 shows its group titles 「放松」「睡前」; the legend at the end under a hairline (caption ink-3, *(new)*: 「名称后的字母是证据等级：A 强、B 中等、C 有限、D 不足，……」) with 「全部依据 ›」.

**睡前身体扫描** is a guided meditation filed under 声音 · 睡前 (practices.ts: people look for it among the bedtime options). It is listed once, there, and counted once in 「17 项练习」 (冥想 10 · 呼吸 4 · 声音 3); the 冥想 filter ends with the caption 「睡前身体扫描在「声音 · 睡前」里。」 *(new)*; its detail page and player are those of a guided practice.

States: a filter other than 全部 shows only that section (计划 stays on top only under 全部). Practices hidden by the health check disappear; their section ends with the caption 「根据健康情况检查，隐藏了箱式呼吸。可以在设置 › 安全里修改。」 *(new)*. Programme rows: not started → the plan line; in progress → 「进行中 · 第 3 周第 2 天」; finished → 「已完成 · 可以重新开始」 *(new)*.

Desktop: page head + folio as on phone, the filter 480 wide; each section spans 12 columns with its rows in two columns (6 + 6, each column its own hairline list, rows flow down the left column first).

### 13.4 练习详情 `/practices/:id` — mock-up detail-slow.png (+ -full) for paced

Phone, all kinds:
1. Navbar 「‹ 练习」.
2. **Intro**: kicker (category label CATEGORY_LABEL on the left; the grade mark with 「证据」 on the right; tools show none); h1 the name; lead = the practice description's first two sentences (`practices.ts`).
3. **Figure** with 「图 1」 caption (per kind, below).
4. **做法** — section head with the durations aside (「3–20 分钟，默认 5 分钟」); Steps from `practice.steps`.
5. **设置** — section head with 「改动会记住」; rows per kind (below).
6. **依据** — section head with 「全部依据 ›」; the **claims list** (§8.10) from `practice.evidenceClaims` *(requested, §14.3)* — one result per line, each with its own grade; until content has it, `evidenceSummary` split at its 「；」, verbatim, each part with the grade content assigns it; then EVIDENCE.grades.scope (caption); Notes for the studies the claims cite.
7. **安全** — section head; `practice.safety` **in order and unchanged — never re-ordered, merged, shortened or paraphrased** (for breathing practices the first line already begins with BREATH_OPENING_LINE; it is not appended again); each line a paragraph in body ink; then 「求助方式 ›」 link-more (`/help`, 44 high) — the route to help on a page whose dock hides the tab bar (PRODUCT.md §10; §8.17).
8. **Dock**: the start bar. PageFrame sets `data-bars="dock"`.

Settings rows print a value only for sliders (节律 「5.5 次/分」); segmented rows show it in the selected cell; a segmented row of bare figures says its unit in the label, 「时长（分钟）」.

Per kind — figure · 设置 rows:
- **paced · 慢呼吸** (as the mock-up): BreathSpecimen · 节律 slider 4.5–6.5 step 0.5, labels 4.5 · 5.0 · 5.5 · 6.0 · 6.5, with the 舒适节律探索 link in its hint *(new)*; 吸与呼 segmented (吸 4.5 · 呼 6.5 / 等长); 开头 90 秒逐步放慢 toggle *(new label and hint)*; 时长（分钟） segmented 3 · 5 · 10 · 15 · 20; 声音 navigation row (「雨 + 长音 ›」); 节拍提示 segmented 滑音 · 钟点 · 仅背景 · 静音 with the selected option's help (SETTINGS.sound.cueStyle).
- **周期性叹息**: BreathSpecimen of the sigh (brackets 吸 2.5 · 再吸 1 · 呼 7) · 时长 1 · 3 · 5; 声音; 节拍提示.
- **箱式呼吸**: BreathSpecimen of 4-4-4-4 · 每步 stepper 3–6 秒 (default 4); 时长 3 · 5; 声音; 节拍提示.
- **专注呼吸**: an empty FocusTimeline of the chosen duration · 时长 5 · 10 · 15 · 20 · 30; 引导详细程度 详细 · 标准 · 安静 (SETTINGS.guidance.level); 声音.
- **数息**: the `breath-count` glyph at 4× with the caption 「1–8 点左边，第 9 口气点右边。」 *(new)* · 时长 5 · 10 · 15 (15 carries the sub-label 「测量版」); 声音.
- **guided** (身体扫描, 三分钟呼吸空间, 慈心, 自我关怀, 开放觉察, 正念行走, 一分钟停一停, 睡前身体扫描): StepChart (body scans) or SectionStrip for the default duration · 时长 segmented; 引导详细程度; 声音. 慈心 adds under 时长 the caption that the difficult person appears only in the 20-minute version and can be skipped (from its practice text).
- **静坐计时**: the timer glyph at 4× · 时长 stepper over 1 · 3 · 5 · 10 · 15 · 20 · 30 · 45 · 60; 间隔钟声 segmented 关闭 · 每 5 分钟 · 每 10 分钟; 钟声 toggle.
- **sound** (听声音 · 放松 / 睡前): the fade figure · 声景 — radio rows with sound icons (雨 · 溪流 · 海浪 · 林间 · 鸟鸣 · 风, then 粉噪声 · 棕噪声 with the hint 「遮蔽环境噪音 · 证据很弱」; 鸟鸣 hidden for 睡前) and a 声景音量 slider; 音乐 — radio rows 无 · 长音 · 五声 · 回响 and a 音乐音量 slider; 时长 segmented (放松 10 · 20 · 30; 睡前 15 · 30 · 45 · 60 · 不限 — 不限 opens UNLIMITED_CONFIRM); LISTEN[mode].note as the duration hint; on iOS SOUND_COPY.iosLock under 时长. No 做法 section; 依据 and 安全 as usual.
- **舒适节律探索**: §13.11.

Desktop: navbar back link above the h1; 12 columns — **1–7**: intro, figure, 做法, 依据, 安全; **9–12**, sticky 40 from the top: 设置 rows and an inline start bar (not docked).

### 13.5 播放器 `/play/:id` — mock-ups player-breath.png, player-breath-landscape.png, player-focus.png, player-guided.png, pause.png, distress.png

13.5.1 **Common**: PlayerFrame (dark, player surface) · HUD · stage · readouts · controls (§8.15). Opening sequence: [练习前自评, §13.5.13] → scene fade (900) → lead-in (§8.15.13) → practice → ending (§8.15.14) → summary (§13.6).
13.5.2 **Paced** (慢呼吸, 周期性叹息): §8.15.5.
13.5.3 **箱式呼吸**: §8.15.6.
13.5.4 **专注呼吸**: §8.15.8.
13.5.5 **数息**: §8.15.9.
13.5.6 **Guided** (身体扫描, 三分钟呼吸空间 and its 应对版, 慈心, 自我关怀, 开放觉察, 正念行走, 一分钟停一停, 睡前身体扫描): §8.15.7. 正念行走 adds under the HUD, for the first 10 s, the caption 「睁着眼睛，在安全、平坦的地方走。」 *(new)*.
13.5.7 **落地练习** (from 不舒服？ and 现在有点难): guided without a strip — the caption and the remaining seconds as t-count 64 at the top-left of the stage; no 跳过. It keeps the 不舒服 control (or chip), which opens the same sheet without the 「60 秒落地练习」 button; that sheet's 结束练习 ends the grounding practice and opens the summary with only 练完感觉.
13.5.8 **静坐计时**: §8.15.10. **听声音**: §8.15.11. **舒适节律探索**: §8.15.12.
13.5.9 **Overlays**: pause panel (§8.15.16); 不舒服？ sheet (§8.15.17, distress.png); sound sheet and end dialog (§8.15.15); toasts — PLAYER.notices.audioBlocked + 「再试一次」; one-time captions under the HUD for 8 s — PLAYER.notices.awakeUnsupported (no wake lock), PLAYER.notices.iosLock (sound players on iOS).
13.5.10 **Interruptions**: losing audio (call, another app) pauses and opens the pause panel; returning never resumes by itself.
13.5.11 **Desktop and tablet**: §8.15.18 — the 640 column centred, curve full width, the 不舒服？ chip in the HUD and three controls; the 不舒服？ sheet becomes a 420 right-hand panel on desktop.
13.5.12 **Landscape phone** (height < 500): §8.15.18 (player-breath-landscape.png) — left 55 %: the stage; right 45 %: HUD with the chip, readouts and three controls; safe-left / safe-right respected.
13.5.13 **练习前自评** (PRODUCT.md §6; only while 设置 › 练习前后自评 is on). After 开始, before the scene fade, a light sheet rises over the page the practice was started from: title SUMMARY.checkin.question 「此刻有多紧张？」, the 0–10 ScaleGroup (§8.16), 「跳过」 (quiet, top right) — nothing else. One tap saves and starts the practice: the scene fade begins 300 ms after the tap, so the selection is seen. 跳过, Esc, a scrim tap or a drag down start it without a score. The lead-in countdown runs after the sheet, never under it. Never asked before: practices started from 现在有点难 or 不舒服？ (a person in distress gets the practice, not a form), sleep sounds, pace-finder runs, and any practice when the person chose 很不舒服 after their previous practice that day. When asking after, the before-score is never shown (PRODUCT.md §6).

### 13.6 小结 (after a practice) — mock-up summary.png (+ -full), in the gentler-suggestion state

Shown at the end of `/play/:id` in the app theme, before returning anywhere. Phone:
1. Navbar: close × on the right (「关闭小结，回到今日」) — equivalent to 完成.
2. Kicker: 「10月22日 08:05–08:15」 · SUMMARY.title 「这次练习」.
3. h1: the practice name; lead SUMMARY.practiced 「练了 10 分钟」; if ended early, SUMMARY.endedEarly as a caption under it.
4. **Data block** (1 px ink rule, 24 above): focus — 「回神」 caption with 「7 次」 (figure 24 light) on the right, the FocusTimeline of the session, caption 「每一道竖线是一次回神。」 *(new)* + SUMMARY.marksNote; count — SUMMARY.count line (数对 · 数错 · 数乱了) and SUMMARY.invalid when needed; paced — a spec strip 轮数 · 节律 (and 「有点急 · 加快到 6.0 次/分」 when used *(new)*); guided — the StepChart / SectionStrip with skipped sections dashed; timer — 「静坐 20 分钟 · 间隔钟声 4 次」 *(new)*; sound — no data block.
5. **本周累计** row (hairlines above and below): SUMMARY.week.
6. **练完感觉怎么样？** — ChoiceGroup + 跳过 (AFTER_PRACTICE). Not after sleep sounds.
7. **此刻有多紧张？** — ScaleGroup (two rows, §8.16) + 跳过, only when 练习前后自评 is on; not after sleep sounds.
8. **备注** — text field.
9. **求助方式 ›** — link-more, caption size, under 备注: the page's route to help (it has no tab bar). Hidden while the gentler block shows, which carries its own.
10. **Dock**: 「完成」 primary block. PageFrame sets `data-bars="dock"`.

States:
- **很不舒服** → the 先休息一下 sheet: AFTER_PRACTICE.unwell title and paragraphs; 「60 秒落地练习」 (primary block); the 求助方式 head + DialGrid; footer 「关闭」 (secondary).
- **Gentler suggestion** (2 of the last 3 feelings, this one included, are 更紧张 or 很不舒服; summary.png): after the choice, a block appears under the choice group (1 px ink rule, 24 above): AFTER_PRACTICE.gentler.title (display 17), its paragraphs (ink-2), two practice rows from `suggestions` (落地练习 1 分钟 · 听声音 · 放松 10 分钟), 「求助方式 ›」. The selected 更紧张 is the same ink fill as any choice — negative feelings are never styled as warnings.
- **< 1 minute**: lead SUMMARY.notRecorded; no data, no questions; only 完成.
- After 落地练习 opened from 不舒服？, and after 结束练习 in that sheet: only the feeling question.

Desktop: a page in the content area (rail visible), reading column 640, left-aligned; 完成 inline at the end.

### 13.7 记录 `/records` — mock-ups records.png (+ -full, phone), records-desktop.png (+ -full)

Phone, top to bottom:
1. Page head 「记录」 + folio: 「10月1日–22日 · 29 次练习」 · 「只在这台设备上」 *(new)*.
2. **Overview**: two cells with a vertical hairline. **Days are the key figure** (frequency over duration, PRODUCT.md §0): 本周 — 「3 天」 (t-figure 40 for the figure), caption 「共 46 分钟」, WeekDots under it; 10月 — 「19 天」, caption 「29 次练习」 / 「共 238 分钟」.
3. **为什么不显示连续天数** — a disclosure under the overview (ink-2, `i-chevron-down`), collapsed by default; it opens the note (body ink-2) and its source caption. It is content, so it stays; as a quiet disclosure it no longer outweighs the data.
4. **10月** — section head 「10月」 with the ‹ › month buttons; MonthCalendar (50 × 44 cells); caption RECORDS.calendar.
5. **各练习** — PracticeBars (bar max 88).
6. **回神次数** — aside 「专注呼吸 · 每 10 分钟」; DotPlot 350 × 160; caption RECORDS.focus.note.
7. **数息练习数据** — Sparkline with the latest accuracy, then rows 日期 · 准确率 · 数乱了 (tabular, right-aligned); RECORDS.count.explain behind a disclosure 「怎么算的」 *(new)*; RECORDS.count.notEnough below 3 sessions.
8. **练习前后自评** — tag 「自评」; the two medians (t-figure) with captions; CheckinStrips 350 wide; captions .noise and .caveat; RECORDS.checkin.notEnough below 5 pairs.
9. **每周压力自评** — only once there are answers (below).
10. **每次练习** — rows: left 「10月22日 周四 · 12:40」 caption ink-3 over the practice name (15 600); right the duration and the data line with the feeling (「28 轮 · 5.7 次/分 · 更平静」「回神 7 次 · 更紧张」) in caption ink-2 — 更紧张 and 很不舒服 are plain text like the rest. Six rows, then 「显示更早的 23 次」 (quiet button). A tap opens the **session detail sheet**: every field of the record (time, practice, duration, data, 练完感觉, 练习前 / 练习后, 备注), then 「删除这条记录」 (danger) → RECORDS.list.confirmDelete dialog → toast 「已删除这条记录。」 + 撤销 (6 s).
11. **导出** — 「导出 CSV」「导出 JSON」 secondary buttons (block, stacked, `i-download`) and SETTINGS.data.export.help.

Empty: EmptyState RECORDS.empty + 「去练习 ›」 *(new)*, and nothing else.

Desktop (records-desktop.png): page head with the export buttons; the subline 「10月1日–22日 · 29 次练习」 only (「数据只保存在这台设备上」 is the rail's caption — said once per screen); overview 4 + 4 + 4: 本周 · 10月 (days as key figures, minutes as captions) · the 为什么不显示连续天数 disclosure; then 10月 (with ‹ ›) · 各练习 · 练习前后自评 (4 + 4 + 4); 回神次数 (7) · 数息练习数据 (5); 每周压力自评 (12, when present); 每次练习 as the table (§8.18), whose 练完感觉 column shows 更紧张 and 很不舒服 like any other value.

**每周压力自评** (PRODUCT.md §3, §8; only while 设置 › 每周压力自评 is on):
- **Instrument**: the single question SETTINGS.practice.weekly.help describes — 「这些天你的压力有多大？」 answered 1–5, anchors 「1 很小」 and 「5 很大」 *(new: question and anchors as their own keys)*. It is a population measure; the app says so wherever it shows results.
- **When**: at most once per calendar week (Monday–Sunday). Outside a programme, on the first visit to 今日 in a week, a link-more 「本周压力自评 ›」 *(new)* appears at the right of the 本周 row, until answered or until the week ends — never a dialog, never a badge. Inside 八周正念, the programme page shows prompt rows in weeks 0, 4 and 8 (§13.10).
- **Answer UI**: a light sheet: the question (title), a one-row 1–5 ScaleGroup (five 58 px cells), the anchors caption, 「跳过」. One tap saves and closes; toast 「已记下。」 *(new)*. No result, score, comparison or praise at the moment of answering.
- **In 记录**: section 「每周压力自评」 with the 「自评」 tag after 练习前后自评: one dot per answered week on a 1–5 axis (ink-2 dots with a ground ring, this week's `--now`), weeks on the x axis as 「10月5日」「12日」…, no line, no trend, no average; caption from the help text that it is a population measure and only a reference for one person; shown from 3 answers on, before that the caption 「答满 3 周后，这里显示每周的点。」 *(new)*.
- **Export**: JSON `weeklyStress: [{ "week": "2026-W43", "answeredAt": "2026-10-22T21:05:00+08:00", "score": 3 }]`; CSV `weekly_stress.csv` with the columns `week,answered_at,score`.

### 13.8 依据 `/evidence` — mock-up evidence.png (+ -full)

Phone: page head 「依据」 + folio (「174 条出处，逐条核对」 · 「最后核对：2026年10月」 — EVIDENCE.method.reviewed shortened, *(new key)*); lead EVIDENCE.intro; **这些结论是怎么来的** — the first method line and 「展开其余 3 段」 *(new)*; **结论** — section head with the active filter and count (「呼吸 · 3 条」), the filter row (全部 · 冥想 · 呼吸 · 声音 · 安全, §8.8), then the cards: the first expanded (§8.10, fields per PRODUCT.md §9, no 可信度), the rest collapsed with design and size in the meta line; **证据等级** — four rows (grade box, word 600, definition caption ink-2) + EVIDENCE.grades.scope; **我们还不知道的** — EVIDENCE.unknown.lines as a hairline list; **未采用** — section head with 「10 项」, EVIDENCE.notAdopted.intro, then each item: name (15 600) with the grade mark on the right, the reason under it (caption ink-2).

States: deep link `/evidence#<card-id>` (from a citation or 「全部依据 ›」) sets the filter to the card's category, expands that card and scrolls it 24 below the top; EVIDENCE.empty when a filter has no cards.

Data: the cards need a curated layer that `evidence.json` does not have (effect sizes, CIs, the comparison sentence, contrary evidence) — §14.3.

Desktop: 12 columns — **1–3**, sticky 40 from the top: the filter as a vertical list of radio rows (the current one ink 600 with a 2 px ink rule on its left) and the 证据等级 key; **4–10**: lead, method, cards, 我们还不知道的, 未采用 (reading column 640).

### 13.9 设置 `/settings`

Pushed from the 今日 masthead (phone) or the rail (desktop). Navbar 「‹ 今日」; h1 「设置」. Groups (group titles) and rows, in this order, all copy from SETTINGS:
1. **外观** — segmented 跟随系统 · 浅色 · 深色 (text only; `i-sun`, `i-moon`, `i-theme-auto` are not used here).
2. **声音** — 默认背景声 (navigation → sub-page: segmented 放松 · 睡前, then the 声景 and 音乐 radio lists); 总音量, 声景音量, 音乐音量, 提示音与钟声音量 (sliders, stacked rows); 节拍提示 (stacked segmented + the selected option's help); 钟声 (toggle + help); 间隔钟声 (stacked segmented 关闭 · 每 5 分钟 · 每 10 分钟); 操作提示音 (toggle); 振动 (toggle; hidden when unsupported).
3. **文字引导** — 引导详细程度 (stacked segmented + the option's help + the note); 新的一句出现时轻提示 (toggle, default on). v1 has no spoken guidance (PRODUCT.md §0): no voice list, no rate.
4. **练习** — 开头倒数 (stepper 0–10 秒); 结尾静默 (toggle); 练习前后自评 (toggle); 每周压力自评 (toggle). There is **no 练完感觉 switch**: PRODUCT.md §8 lists none, and turning it off would silently disable PRODUCT.md §6's safety rule (2 of the last 3 feelings 更紧张 or 很不舒服 → a gentler suggestion and the route to help). The question stays skippable every time. Content is asked to remove SETTINGS.practice.feeling (§14.3).
5. **提醒** — navigation → the reminder page.
6. **安全** — 健康情况检查 · 停止指引 · 求助方式 · 练习后的变化自查 (navigation rows).
7. **数据** — 存储方式 (an information row with the current mode's text); 导出 (two secondary buttons); 导入备份 (secondary button `i-upload` + help; result as a toast); 隐私说明 (navigation → the six lines as a reading page); 删除全部数据 (danger button → two dialogs → toast).
8. **关于** — 免责声明 · 版本 (value 「1.0.0」 tabular, no chevron) · 开源字体许可 (navigation).

Hints are shown in full under their rows (caption ink-3).

**提醒 page**: intro (ink-2); the plan sentence set as a sentence at reading size with three blanks — 【刷牙后】【3 分钟慢呼吸】【1 分钟】 — each blank an inline button (ink 600, 1 px `--line` underline 4 px below, 44 high target) that opens a choice sheet (cues + 「自己写」 · practice and minutes · 1 / 3 / 5 分钟); 一键填入 presets as quiet rows below; 提醒时间 — 工作日 and 周末 rows, each with a time field (native `<input type="time">` styled as `.field`) or 不提醒; 「生成日历文件」 primary block (`i-calendar`) and the calendar help lines as a numbered caption list.

**健康情况检查**: h1, the HEALTH_CHECK intro (safety.ts), each question as a toggle row (是 = on), a notice block per answer as specified in safety.ts, 「保存」 primary; answers stay on the device.

**练习后的变化自查**: AFTER_PRACTICE.monthly — the intro, then each item with a three-cell choice group (没有 · 有，一天内过去了 · 有，超过一天), the result text (ink, under a 1 px ink rule), the self-harm question and its response with the DialGrid.

Desktop: 12 columns — **1–3** sticky: the group names as an anchor list; **4–10**: the rows (640).

### 13.10 计划 `/program/:id`

Navbar 「‹ 练习」 (「‹ 今日」 when opened from Today). Kicker 「计划 · 8 周」 *(new)*; h1 the programme title; lead = the first two sentences of `summary` with 「展开全文」 *(new)*.
- **Progress figure**: one 24 px square per week (8 or 4) in a row, 8 apart; completed weeks filled ink, the current week outlined 2 px ink, later weeks 1 px `--line`; under the current week, seven 6 px dots for its days (done: ink; to do: none drawn). No percentage, no "behind".
- **本周** — section head 「第 3 周 · 身体扫描」; the week's theme (ink-2); 「本周说明」 disclosure with the reading text (reading size, ~1 minute); today's tip (caption, ink-3); practice rows: the daily practice (10 分钟), 保底日 (5 分钟), 可选 (三分钟呼吸空间 3 分钟).
- **全部 8 周** — rows: 「01」 tabular ink-3, the week title (15 600) and theme (caption ink-2); completed weeks end with `i-check` 16 ink-2; the current week with 「进行中」 caption.
- Weekly stress self-check prompt rows in weeks 0, 4 and 8 when 每周压力自评 is on: a navigation row 「本周压力自评」 with the hint 「一道题，1–5」 *(new)* that opens the sheet of §13.7; once answered the row shows 「已记下」 in caption ink-3, without the score.
- Quiet 「重新开始计划」 at the end → dialog.
- Dock: the start bar for today's practice.

Desktop: 7 + 5 — the figure, 本周 and 全部 8 周 on the left; the lead and the start bar (inline) on the right, sticky.

### 13.11 舒适节律探索 `/pace-finder`

- **Intro** (pushed, dock): kicker 「呼吸 · 工具」 *(new)*; h1 「舒适节律探索」; lead from the practice description, which says plainly that this is a comfort test; figure: a SectionStrip of five equal treads labelled 6.5 · 6 · 5.5 · 5 · 4.5 次/分; 做法 steps; an optional row 「心率带（实验）」 with `i-bluetooth` and a small secondary 「连接」 — hidden when Web Bluetooth is unavailable; dock start bar 「约 7 分钟」.
- **Run**: §8.15.12.
- **Result** (light page, dock): h1 「你的舒适节律」 *(new)*; the chosen rate as a key figure (t-figure 40, unit 次/分); a five-row table — rate (tabular) · ease as 1–5 dots (filled = rating) · mean heart rate when a strap was connected; the chosen row's rate in 600 (ink, not cinnabar); dock: 「设为慢呼吸的节律」 primary and 「不用了」 quiet *(new)*.

### 13.12 首次使用 `/welcome` and 开始之前

- No tab bar, no rail. Phone: the lockup at 48 below safe-top (seal 24, wordmark 24 / 32); WELCOME.tagline (reading ink-2) 16 below; the three WELCOME.lines as a hairline list (body ink); WELCOME.scope (caption ink-3); section 「你的数据」 with WELCOME.privacy.lines; at the bottom (sticky, safe area): 「先练 1 分钟」 primary block and 「看看全部练习」 quiet button.
- 「先练 1 分钟」 → the **开始之前** sheet (FIRST_RUN_NOTICE in safety.ts; before-start.png): full height (from safe-top + 12), no grabber, not dismissible; title and sections (paragraphs and lists in body ink, headings name size, last lines ≥ 4 characters); 「查看求助方式 ›」 (FIRST_RUN_NOTICE.help) after the last section; a sticky footer with FIRST_RUN_NOTICE.readToEnd 「读到最后，才能确认。」 (caption ink-3) over the confirm button FIRST_RUN_NOTICE.confirm 「我已读完」, which is `aria-disabled` (paper-sunk fill, ink-3 label) until the last paragraph has been scrolled into view (IntersectionObserver), then primary — the label never changes; confirming stores the flag and starts 一分钟停一停. At 200 % text the body scrolls and the footer stays.
- Desktop: the same content in a 640 column left-aligned at the content start; 开始之前 as a 560 dialog with an internal scroll.

### 13.13 求助方式 `/help`

Offline, bundled, reachable as in §8.17. Navbar back; h1 CRISIS_CARD.title 「求助方式」; lead CRISIS_CARD.body; CRISIS_CARD.emergency in ink 600 with 120 and 110 as `tel:` links; then one group per region (CRISIS_RESOURCES) with PhoneRows (name, description and hours, number); CRISIS_CARD.dialing (caption); section **停止指引** (`#stop`) with STOP_GUIDANCE in full (as in the pause panel); footer: CRISIS_CARD.footer and 「最后核实：2026-10-22」 (caption ink-3); a 「来源」 disclosure listing each line's source (caption).
Desktop: reading column 640.

### 13.14 System states

- **404**: EmptyState 「找不到这个页面」 · 「回到今日 ›」 *(new)*.
- **Error boundary**: EmptyState 「这个页面出了问题」 · 「练习记录没有受影响。」 · 「回到今日」 (secondary) and 「重新加载」 (quiet) *(new)*.
- **New version** (Workbox prompt): toast 「有新版本」 + 「更新」 *(new)*; never during a practice.
- **Storage fallback** (SETTINGS.data.storage.local / .memory): a notice at the top of 记录 — `i-info` + the text, ink, under a 1 px ink rule — and the same line in 设置 › 数据.
- **Wake lock, iOS lock**: §13.5.9.

---

## 14. Mock-ups, decisions, requests

### 14.1 Final mock-ups (`docs/design/final/`)

Every PNG below was rebuilt from the current `tokens.css`, `components.css`, `icons.svg` and `src/content` and passed the audit (§14.4); each HTML file carries the hashes it was built from (`<meta name="huishen-build">`).

| File | Screen | Theme | Viewport |
| --- | --- | --- | --- |
| `today.png` | 今日 — programme recommendation, 只有几分钟, 现在有点难 row | light | 390 × 844 @2 |
| `today-dark.png` | 今日 in dark — the ink-2 start bar | dark | 390 × 844 @2 |
| `practices.png`, `practices-full.png` | 练习 — filter row, 计划, catalogue with glyphs and grade letters | light | 390 × 844 @2, full page |
| `detail-slow.png`, `detail-slow-full.png` | 慢呼吸 detail — specimen, 做法, 设置, claims, 安全 with 求助方式, dock | light | 390 × 844 @2, full page |
| `player-breath.png` | 慢呼吸 player — ink-2 phase word and curve, 有点急, four controls | dark | 390 × 844 @2 |
| `player-breath-landscape.png` | the same, phone on its side — two columns, HUD chip | dark | 844 × 390 @2 |
| `player-focus.png` | 专注呼吸 player — timeline, guide line, 回神 key with its edge and touch hint | dark | 390 × 844 @2 |
| `player-guided.png` | 身体扫描 player — section, step chart, caption, 这一处还剩 | dark | 390 × 844 @2 |
| `pause.png` | 已暂停 — the pause panel with the full stop guidance | dark | 390 × 844 @2 |
| `distress.png` | 不舒服？ sheet over the paused focus player | dark | 390 × 844 @2 |
| `distress-200.png` | the same at 200 % text — the body scrolls, the footer stays | dark | 390 × 844 @2 |
| `summary.png`, `summary-full.png` | 小结 after 专注呼吸 10 分钟 — 更紧张 chosen, the gentler suggestion, the two-row scale | light | 390 × 844 @2, full page |
| `records.png`, `records-full.png` | 记录 on phone | light | 390 × 844 @2, full page |
| `records-desktop.png`, `records-desktop-full.png` | 记录, desktop (one table row in its hover state) | light | 1440 × 900 @1, full page |
| `evidence.png`, `evidence-full.png` | 依据 — method, filter row, a full evidence card, 未采用 | light | 390 × 844 @2, full page |
| `before-start.png` | 开始之前 — the first-run notice, confirm not yet available | light | 390 × 844 @2 |
| `states.png` | keyboard board — the real `:focus-visible` style of every component, light and dark, and the tab icons at size | light, dark | 1200 wide @1 |

All screens share one dataset (`src/data.mjs`) and tell one morning without contradiction: today is 2026-10-22, 星期四, 霜降前一日; the person is on day 2 of week 3 of 八周正念; this week = Mon 10-19 → Thu 10-22, 3 days, 46 minutes (Tuesday not practised — and therefore not marked). 08:05 they start today's 10-minute 专注呼吸 (player-focus.png at 08:11, six 回神 so far, 03:08 left); at 08:12 they open 不舒服？ (distress.png); they continue, finish at 08:15 with seven 回神 and choose 更紧张 — with 很不舒服 after 慢呼吸 the day before, 2 of the last 3 feelings are tense or unwell, so the summary shows the gentler suggestion (summary.png). The records table shows those sessions, negative feelings included, styled like every other row.

### 14.2 Decisions of v1.0 (2026-10-23, before review)

Item 7 is superseded by §15.2 row 5 (the grade letter follows the name; the duration stands alone) and item 11 by §15.2 row 17 (one text tracking for every button label).

1. **Missed days are empty.** The hollow "no practice" ring is gone from the week and the month; the `--dot-empty` token is deleted. Today has its own marker: the cinnabar label or numeral with a 10 px cinnabar rule.
2. **本周 is seven dots, not minute bars**: frequency over duration (PRODUCT.md §0, §4.5). Same component on 今日 and 记录.
3. **The display serif ships as two static instances** — 600 for every CJK character in `src`, 300 for the phase word only — 223 KB instead of 396 KB for one variable file.
4. **Inter, not IBM Plex Mono**, for figures.
5. **A figure binds to its unit and a statistic to its operator** (U+00A0); **captions break only at punctuation**.
6. **The 不舒服？ sheet uses the dial grid** so stop guidance, the emergency line, grounding, four numbers with the verification date, and 继续 / 结束 fit one 390 × 844 screen without scrolling.
7. **Catalogue rows show the grade (box + word) over the default duration**; tools carry no grade; programmes open the 练习 page.
8. **Evidence effect sizes are full-width rows on one shared axis**; a missing CI is never drawn.
9. **Step chart**: the current tread splits at *now*; future treads are `--line`.
10. **The desktop records table uses fixed layout** (its 备注 column had inherited the `.note` component's grid and broke the row rules; the table now uses `.memo`).
11. **Long button labels** use body tracking (`.btn--long`).
12. **The phase-word row is not a live region** (it was in the first player mock-up's HTML); in players only captions are live (§11).

### 14.3 Requests to the content owner (`src/content`)

Strings this document uses that are not yet in content — add them and reference them from components (no Chinese in components). Each one is in `docs/design/final/src/content.mjs` → `NEW` under the key named here, so the mock-ups show exactly what is being asked for.
- **今日**: `TODAY.hard.rowHint` 「周期性叹息 · 落地练习 · 求助电话」; `todayLine` per practice (model: 「从左腿开始，一处一处往上，留意身体的感觉。可以躺着练，睡着了也没关系。」 — its first body word matches the first tread); the structure lines of the 只有几分钟 rows; the focus figure caption 「每次回神，留一道竖线。」; 「本周压力自评 ›」.
- **练习**: folio 「17 项练习」 (computed) / 「时长为默认值」; 计划 aside 「按完成的天数推进」 (replaces 「按练过的天数往下走」, which was unclear); the legend 「名称后的字母是证据等级：……」; 「睡前身体扫描在「声音 · 睡前」里。」; the hidden-by-health-check caption; programme row states.
- **练习详情**: `practice.evidenceClaims: { claim, grade, cites: evidenceId[] }[]` — one graded result per line, replacing the single `evidenceSummary` sentence that carried two results of different strength under one grade (慢呼吸: split at 「；」, both B; `src/data.mjs` → `SLOW_CLAIMS` is the model); 「时长（分钟）」; the 节律 hint, the 吸与呼 hint, 「开头 90 秒逐步放慢」 and its hint; 「图 1」 captions per practice; 「1–8 点左边，第 9 口气点右边。」.
- **播放器**: `PLAYER.focus.markHint` splits into `markHintTouch` 「也可以轻点屏幕的任何地方」 and `markHintKeys` 「也可以按」 (+ the 空格 keycap) — the old single string told a phone user to press a key; `PLAYER.unwellShort` 「不舒服」 (the control label; the accessible name stays 「不舒服？」); `PLAYER.unwell.paused` 「练习已暂停。」, `.endPractice` 「结束练习」, `.fullGuidance` 「停止指引全文」; `PLAYER.paced.hurryHint` 「点一下，每分钟加快 0.5 次」, `.hurried` 「已加快到 6.0 次/分」, `.hurryMax` 「已到上限：6.5 次/分」 (replaces the superlative 「已是最快的 6.5 次/分」); `PLAYER.guided.sectionLeft` 「这一处还剩」; `PLAYER.pause.elapsed` 「已练」, `.left` 「还剩」, `.keys` 「键盘：空格继续练习，Esc 关闭面板并继续。」; the count-pad captions and key line; the end dialog (「结束这次练习？」「已练 6 分钟，会记在记录里。」「继续练习」「结束」); the walking safety caption.
- **小结**: 「每一道竖线是一次回神。」; the paced 有点急 line; the timer data line.
- **记录**: folio 「只在这台设备上」; 「怎么算的」; 「去练习 ›」; 「上个月」「下个月」; 「最近一次」; 「显示更早的 23 次」 (computed); 为什么不显示连续天数 — title, body and source as their own keys; 每周压力自评: the question 「这些天你的压力有多大？」, the anchors 「1 很小」「5 很大」, 「已记下。」, 「答满 3 周后，这里显示每周的点。」, the programme row hint 「一道题，1–5」.
- **依据**: 「最后核对：2026年10月」 as its own key (the folio form of EVIDENCE.method.reviewed); 「展开其余 3 段」, 「展开」/「收起」, 「结论」 and the filter count; **a curated evidence-card data layer**: `EvidenceCard { id, category, topic, grade, claim, outcomes: { name, k?, n?, g, lo, hi }[] | stat?: string, design, limits, contrary: { claimId, text }[], source: claimId }` — `evidence.json` has no effect-size, CI or contrary fields. The card in evidence.html is the model: breathing-fincham-2023-meta (g and CIs from its `finding_zh`) with breathing-fincham-2023-rct as the contrary evidence.
- **Remove**: `EVIDENCE.card.certainty`, `EVIDENCE.weights` and `EVIDENCE.weightsNote` from anything a card renders (PRODUCT.md §9 has no 可信度 field; the per-study weight stays in `evidence.json` for research use); `SETTINGS.practice.feeling` (no 练完感觉 switch, §13.9).
- **Dates and decimals**: write calendar references solid (§4.4) — `EVIDENCE.method.reviewed` 「最后核对：2026年10月 · 下次核对：2027年10月」, the CRISIS_RESOURCES description 「2025年5月1日起」 and every other 「YYYY 年 M 月」; `PLAYER.paced.rate` and every rate printed with 次/分 use one decimal (`toFixed(1)`: 「6.0 次/分」). Add the content lint of §4.4 to `copy.test.ts`.
- **舒适节律探索**: kicker, the rating question and anchors, the result title and actions. **开始之前**: in content already (`readToEnd`, `confirm`, `help`). **计划**: kicker and 「展开全文」. **System**: 404, error boundary, new-version toast.

### 14.4 Re-rendering the mock-ups — the handoff gate

`node docs/design/final/src/build.mjs [page …]` expands `src/pages/<page>.html` with the content of `src/content` (loaded by `src/content.mjs`), writes `docs/design/final/<page>.html`, renders the PNG (and `-full.png` for long pages) with headless Chrome at the exact viewport — phones as touch screens (no hover, coarse pointer), desktops with a fine pointer — and prints an audit per screenshot, stamped with a hash of `tokens.css`, `components.css`, `icons.svg` and `src/content`:
- type sizes used and font families; input mode;
- horizontal overflow; text below 4.5 : 1 (3 : 1 for large text); text collisions (text hidden behind an opaque bar, or clipped by its scroll container, does not count);
- interactive targets under 44 × 44 (chips and small buttons excepted: their `::before` extends the target);
- **short last lines**: any block that wraps and ends on fewer than four characters (§4.3);
- **route to help**: a page without a visible tab bar must contain a visible `/help` link or a `data-unwell` control (PRODUCT.md §10).

**Gate.** The build exits 1 when an audit finds any of these defects, and when **any** PNG in `docs/design/final/` is older than `tokens.css`, `components.css`, `icons.svg`, a content file or its own HTML (`node src/build.mjs --check` runs only this freshness test). Mock-ups are handed over only from a clean build; a PNG that no page produces is reported for deletion. `--no-shoot` writes HTML only. States the screenshots cannot show by themselves (keyboard focus, a hovered table row) are forced with `data-force="focus-visible"` / `"hover"`, which the build applies through `CSS.forcePseudoState`.

---

## 15. Decisions after review (2026-10-23)

An independent senior critic reviewed v1.0. Every must-fix item is applied; should-fix items are applied unless a row below says otherwise; every spec gap is filled in the section named. *Applied* means the CSS, the icons, this document and the affected mock-ups changed; *Differently* means the problem is fixed by another route than the one proposed; *Declined* states why.

### 15.1 Must fix

| # | Finding | Decision | Where |
| --- | --- | --- | --- |
| 1 | 练习详情 had no route to help; with the dock hiding the tab bar, numbers were 3 steps away | **Applied.** 安全 ends with 「求助方式 ›」 (44 px, `/help`). The build now fails any page without a tab bar that lacks a `/help` link or the 不舒服 control; the summary gained its own link | §8.17, §13.4, §13.6, §14.4 |
| 2 | Invented 安全 copy that told someone short of air to slow down | **Applied.** The mock renders `practice.safety` from `src/content` verbatim; §13.4.7 now says *in order, unchanged, never re-ordered or paraphrased* and no longer appends BREATH_OPENING_LINE (it would have printed twice) | §0, §13.4 |
| 3 | 今日 icon was a square-in-square: read as ■ stop and copied the seal | **Applied, sunrise.** The dated leaf was drawn and rejected: next to the new 记录 dot calendar, two framed pages differed only by their dots at 24 px. A first sunrise — a full disc over the horizon — read as a "profile" glyph and was redrawn: the half sun on the horizon with three rays (旦). Reserved shapes rule added | §9 |
| 4 | 现在有点难 was a grey link in a section head | **Applied.** A full-width navigation row after the three quick rows: grounding glyph, 15 / 24 600 label, ink-3 hint, chevron | §8.6, §13.2 |
| 5 | 不舒服？ chip top-right, styled like 有点急 | **Applied.** Phone held upright: a fourth equal control (暂停 · 声音 · 不舒服 · 结束) with `i-help`. Tablet, desktop, landscape: a 44 px HUD chip with `i-help`. Exactly one exists at any size — two entries 300 px apart only add noise | §8.15.3, §8.15.15, §8.15.18 |
| 6 | Emergency line was the smallest, dimmest text; 120 not a link; 继续 led the footer | **Applied.** Body 15 / 24 in ink, phrase-wrapped, 120 a `tel:` link; footer 「结束练习」 (secondary, left) · 「继续」 (quiet, right); what 结束练习 does is written down (no dialog, recorded if ≥ 60 s, summary asks only 练完感觉). The first stop item is now content's first (头晕的话……), which v1.0 had skipped | §3.5, §8.15.17 |
| 7 | 0–10 cells were 31.8 px wide | **Applied, two rows** on one 58 px pitch (57 × 48 cells). The 44 px claim stands; no exception needed. Anchors became one caption line 「0 一点也不 · 10 非常紧张」 — a caption at the end of row 2 would have sat under 4 and 10, not 0 | §8.16 |
| 8 | Selected segment 1.19 : 1, shadowed, a third selection idiom | **Applied.** Selected = ink fill, `--on-ink` 600, no shadow — `.seg` is now built like `.choice`. Filters became a typographic row with a 2 px rule. Selected-state contrast added to §11 | §8.8, §11 |
| 9 | `scroll-padding` specified but never shipped | **Applied** in `tokens.css` with `data-bars` on `<html>` (tabs, dock, player, none) and tablet/desktop values; e2e test written into §11 | §11 |
| 10 | Keyboard hint on a phone; string differed from content | **Applied.** markHintTouch / markHintKeys chosen by `(hover: hover) and (pointer: fine)` and its complement, via `data-modality`. *Differently* on one point: desktop shows the key hint only, not both — 「轻点屏幕」 is wrong under a mouse | §8.15.8, §10.2 |
| 11 | 可信度 field not in PRODUCT §9; 「B 中等」 next to 「中」 | **Applied:** removed from the card and the collapsed meta. *Differently*: the critic's 「偏倚风险：中等」 was not adopted, because it reuses the grade word 中等; a study's weight is said in plain words in fields 4 or 6 | §8.10 |
| 12 | One sentence, two results, one grade | **Applied.** One graded result per line (`.claims`); `evidenceClaims` requested. *Differently* on wording: the critic proposed 「……尚无定论」; content deliberately says the 400-person trial found no advantage (practices.ts), so the split keeps content's words | §8.10, §13.4, §14.3 |
| 13 | Every PNG older than the CSS | **Applied.** All 23 PNGs rebuilt; build fails on staleness and stamps CSS, icon and content hashes into each audit and HTML | §14.4 |
| 14 | Two- and three-character last lines | **Applied, tightened to ≥ 4 everywhere**, not only in sheets: `keep()` binds the last four characters; `clauses()` for spoken, safety and figure-caption text; an audit for every block. Clause wrapping was first applied to every note and card field — it left ragged notes, so it was narrowed | §4.3, §14.4 |
| 15 | Date and figure rules contradicted each other | **Applied.** Calendar references solid, quantities spaced; 年 月 日 removed from `bindUnits`; `mm:ss` everywhere; rates with one decimal; ISO only in 最后核实; proper-noun exception; content lint requested | §4.4, §4.5 |

### 15.2 Should fix

| # | Finding | Decision |
| --- | --- | --- |
| 1 | Today's h1 changed with 换一个; desktop differed | **Applied**: hidden 「今日」 h1 at every breakpoint, recommendation h2 `.t-display`, `document.title` per route (§13.1) |
| 2 | Glare in players at night | **Applied, and extended**: phase word and past curve ink-2 on the player surface; primary fills ink-2 in **all** dark mode (§3.2) — today-dark.png showed the same slab glare outside players. `--on-ink-2` dark darkened to #3E3C38 to keep 5.07 : 1 on it |
| 3 | 慢呼吸 and 周期性叹息 glyphs alike | **Applied**: the sigh glyph is one whole cycle (§8.6) |
| 4 | Grey fill under the light specimen; floating 「秒」 | **Applied**: line only on reading pages, 「30 秒」 on the last label (§8.9) |
| 5 | Badge column in catalogue rows | **Applied** as "box only, words in the legend": the letter follows the name, the duration stands alone. *Declined*: replacing `practice.short` with structure lines — the catalogue is where newcomers learn what a practice is; the last-line rule handles orphans |
| 6 | Readout position; live 回神 count; 「这一处」 | **Applied**: readouts above the controls everywhere; focus shows 剩余 only; 「这一处还剩」 (§8.15.4) |
| 7 | 为什么不显示连续天数 too loud; duplicate storage line | **Applied**: a collapsed disclosure under the overview (phone) and in its third column (desktop); the subline no longer repeats the rail caption (§13.7) |
| 8 | Minutes shown as key figures | **Applied**: days are the key figure, minutes a caption (§13.7) |
| 9 | Calendar head and PracticeBars mismatched the spec | **Applied**: ‹ › month buttons in the mock; the text now says the bar takes what is left (88) — 200 px never fitted a 4-column cell (§8.9) |
| 10 | 记录 and 设置 icons | **Applied**: dot calendar; gear (§9) |
| 11 | Hover stuck on iOS | **Applied**: every hover rule under `(hover: hover) and (pointer: fine)` (§7.2) |
| 12 | px type ignores the font-size preference | **Applied**: rem for text roles; instrument figures, phase word and figure labels stay px (§4.2); 200 % test rendered (distress-200.png) |
| 13 | 回神 key edge invisible | **Applied**: 1 px `--line` edge, 3.11 : 1 (§8.15.8). The box stays: it is the instrument the hint describes |
| 14 | 全身 as a block; labels differing from titles; 左脚 vs 左腿 | **Applied**: 全身 is the top tread; labels are titles or their first word; todayLine starts 「从左腿开始」. *Declined*: the bracket over all treads — in 40 px of height it read as a ceiling line (§8.15.7) |
| 15 | Dataset contradictions; all-positive feelings | **Applied**: one continuous morning across four screens; the table shows 更紧张 and 很不舒服; the summary shows the gentler state (§14.1) |
| 16 | Superlative; unclear aside; strings diverging from content | **Applied**: 「已到上限：6.5 次/分」, 「按完成的天数推进」; mocks load `src/content` directly (§14.3) |
| 17 | Seven tracking values | **Applied**: 0.02 / 0.04 / 0. *Differently*: the wordmark keeps 0.12em besides the 回神 key — it is the logo, and `logo.svg` is drawn that way (§4.2) |
| 18 | Platform rendering never checked | **Applied as spec** (§4.1.1, expected weights per platform). *Open*: Windows and Android renders could not be produced in this environment — they remain a sign-off item (§15.4) |
| 19 | Stacked rows repeat the value | **Applied**: value only on slider rows; 「时长（分钟）」 (§8.7) |
| 20 | No focus states shown | **Applied**: states.png forces the real `:focus-visible` on every component in light and dark; it found and fixed one defect (the dial cell's inset ring cut its label) |
| 21 | Primary flows without mocks | **Applied** for the minimum named: records (phone), today-dark, before-start, pause; plus the landscape player and the 200 % sheet. *Open*: 设置 with the 提醒 sentence, the 数息 / 计时 / 声音 players, 舒适节律探索 result and 计划 (§15.4) |

### 15.3 Spec gaps filled

| Gap | Filled in |
| --- | --- |
| Pre-practice 「此刻有多紧张？」: when, where, skip, lead-in, never after 现在有点难 / 不舒服？ | §13.5.13 |
| 每周压力自评: instrument, answer UI, result copy, place in 记录, export fields | §13.7, §13.10 |
| 设置 › 练习 「练完感觉」 toggle not in PRODUCT §8 | Removed (§13.9): it would silently switch off the 2-of-3 safety rule |
| Responsive behaviour only in prose | `components.css` now switches tab bar ↔ rail (80 / 240), sheets ↔ dialogs and right panel, centred 640 player, landscape two-column player (§5.2, §8.12, §8.13, §8.15.18; player-breath-landscape.png) |
| Date and number formatting | §4.4, §4.5 |
| Contrast of selected states, current tab, key boundaries | §11 |
| What 结束 does in 不舒服？; the grounding player's own chip | §8.15.17, §13.5.7 |
| Input-modality copy | §10.2 |
| §13.4.7 vs safety.ts | §0, §13.4 — content wins, unchanged order |
| 可信度 vocabulary vs grade words | §8.10 |
| Platform font weights | §4.1.1 |
| Text scaling and which region scrolls first | §4.2, §8.13, §11 |
| Circular mock-up authority | §0, §2, §14.4 |
| Today's h1 per breakpoint; `document.title` per route | §13.1 |
| 睡前身体扫描: filter and count | §13.3 |
| 0–10 layout vs the 44 px rule | §8.16 |

### 15.4 Still open

- **Platform renders**: records-desktop on Windows 11 (Chrome, Edge) and 今日 on a Pixel and a Xiaomi or Huawei phone, before sign-off (§4.1.1). This environment renders only with PingFang.
- **Mock-ups not yet drawn**: 设置 (and the 提醒 sentence builder), the 数息, 静坐计时 and 声音 players, the 舒适节律探索 run and result, 计划, the 现在有点难 sheet and 先休息一下, the 每周压力自评 sheet and section, a tablet layout. Their recipes are complete; each needs a page in `src/pages/` and a clean audit.
- **Content**: everything in §14.3 — above all `evidenceClaims`, the split `markHint`, the date and decimal fixes, and the removals.
- **Engineering**: the focus-under-bar e2e test (§11) and the content lint (§4.4) are specified, not yet written.

