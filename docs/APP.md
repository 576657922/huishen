# 回神 · App layer (APP.md)

**Binding for every screen engineer.** Version 1.1 · 2026-10-24 · app shell (no-voice pivot: text guidance, caption cue, bells, new practice prefs, 4.5–7.0 rate range).
It says how the app wires the modules together: boot, routes and frames, services, hooks, the session flows, the plan builder, the shared widgets, and the dev/test hooks. Use these; do not re-implement them in a feature.

Reading order: `docs/PRODUCT.md` (what) → `docs/design/DESIGN.md` (how it looks and behaves) → `docs/modules.md` (APIs of `src/engine`, `src/audio`, `src/data`, `src/hrv`) → this file (how the app uses them).
Precedence: PRODUCT.md decides behaviour, DESIGN.md decides appearance, `src/content` holds every string. Where this file and the code disagree, the code's JSDoc is the detail and this file is the contract — report the mismatch.

---

## 0. Product decisions the app layer already applies

- **v1 has no voice guidance** (PRODUCT.md §0, decided 2026-10-23). Guided practices show their timeline as on-screen text (`state.caption`, §8.3). Every plan has `voice: false`; there is no voice service — the session controller gets `NULL_VOICE` from `@/engine`. A line that appears after ≥ 20 s of quiet gets a very soft tone (`plan.captionCue` ← `prefs.captionCue`, 设置 › 文字引导 「新的一句出现时轻提示」, default on). Do not build voice settings, voice lists, 「试听」 voices or voice-unavailable notices; do not call `speechSynthesis` or `audio.setDuck` (kept only for future recordings).
- **Not offered in v1**: `walking` and `body-scan-sleep` (PRODUCT.md §2). The list and the check live in content (`V1_UNAVAILABLE`, `isOffered(id)` in `@/content/practices`; `@/app/plan` re-exports both). `isOffered` is `false` for them and for unknown ids; `startPractice` returns `'unavailable'` and `/play/walking` (or any not-offered id) shows 404. Catalogue, Today and programmes filter with `isOffered`.
- Leaving `/play/:id` (back button, a link in a sheet, any navigation) **ends the running practice**; it is recorded if it lasted ≥ 60 s; no summary.

---

## 1. Directories and imports

```
src/app/            boot pieces, router, frames (layout/), services, hooks/, flows/, plan, theme, PWA, system pages
src/widgets/<Name>/ cross-feature widgets with a documented API (§9)
src/features/<f>/   one folder per page family; index.tsx exports the page component(s) named in §3
src/dev/            dev-only code (never in a production build)
```

A feature may import: `@/ui`, `@/widgets/*`, `@/app/hooks`, `@/app/flows`, `@/app/services`, `@/app/layout`, `@/app/plan` (pure helpers), `@/app/navigation`, `@/app/strings`, `@/app/pages/NotFound`, `@/content/*`, `@/data`, `@/engine` (types and pure functions only — never `createSessionController`), `@/hrv`, `@/lib/*`.
Features never import each other. Something two features need goes to `@/ui` (design system), `@/widgets` (behaviour + UI) or `@/app` (wiring) — ask the owner.

---

## 2. Boot (`src/main.tsx`)

1. `import '@/ui'` — tokens, base styles and the icon sprite (inlined once).
2. Dev builds only: `applyDevParams()` from `src/dev/seed.ts` handles `?seed=demo` and `?speed=N` (§11). This branch and `src/dev` are absent from production builds.
3. `applyTheme(prefs.theme)` before the first render, so a forced dark theme never flashes light.
4. `initFlows()` — subscribes to the controller's `onFinish`, keeps a synchronous snapshot of the records, cancels stale resume countdowns.
5. `createAppRouter()` → `<RouterProvider>` inside `<StrictMode>`.

Nothing creates an `AudioContext` at boot. The audio engine is created on first use inside a user gesture (§5).

---

## 3. Routes (PRODUCT.md §1)

Every page is lazy-loaded from `src/features/<feature>/index.tsx` by the **named export** below. Keep the names.

| Path | Frame | Export (module) | `PageFrame` variant | Notes |
| --- | --- | --- | --- | --- |
| `/` | AppFrame | `TodayPage` (`today`) | `tabs` | Loader: `prefs.onboarded === false` → redirect `/welcome`. Uses `Masthead` and `Dateline` from `@/app/layout`; h1 visually hidden 「今日」 |
| `/practices` | AppFrame | `CataloguePage` (`practices`) | `tabs` | |
| `/practices/:id` | AppFrame | `PracticeDetailPage` (`practices`) | `dock` | Never receives `listen`, `sleep` or `pace-finder` (routes below) |
| `/practices/listen`, `/practices/sleep` | AppFrame | `SoundDetailPage` (`sound`) | `dock` | The practice id is the last path segment |
| `/practices/pace-finder` | — | — | — | Redirects to `/pace-finder` |
| `/play/:id` | `PlayerRoute` | `PlayerPage` and `SummaryPage` (`player`) | `PlayerFrame` / `dock` | §8 |
| `/records` | AppFrame | `RecordsPage` (`records`) | `tabs` | |
| `/evidence` | AppFrame | `EvidencePage` (`evidence`) | `tabs` | `#<card-id>`: after render, focus (and scroll) moves to the element with that id (§4.3) — give the card that `id` |
| `/settings/*` | AppFrame | `SettingsPage` (`settings`) | `tabs` | Owns its sub-pages (`/settings/reminders`, …) with descendant `<Routes>` |
| `/program/:id` | AppFrame | `ProgramPage` (`program`) | `dock` | `:id` is a `ProgramId`; anything else renders `NotFound` |
| `/pace-finder` | AppFrame | `PaceFinderPage` (`pace-finder`) | `dock` | Runs render `<PlayerFrame embedded>` (§8.4) |
| `/welcome` | AppFrame without navigation | `WelcomePage` (`onboarding`) | `bare` or `dock` | `PageFrame title={null}` → document title 「回神」 |
| `/help` | AppFrame | `HelpPage` (`help`) | `tabs` | Offline: bundled content only, no fetch |
| `*` | AppFrame | `NotFound` (`@/app/pages/NotFound`) | `tabs` | EmptyState 「找不到这个页面」 + 「回到今日 ›」 |

Errors thrown while rendering a route show `ErrorPage` (「这个页面出了问题」, 「回到今日」, 「重新加载」) inside the same frame; it also ends a running practice.

Navigation outside components (flows): `navigate(to, { replace?, state? })` from `@/app/navigation` — the router registers itself with `setNavigate`. Inside components use React Router's `useNavigate` / `<AppLink>` (`@/ui`).

---

## 4. Frames (`@/app/layout`)

### 4.1 AppFrame (rendered by the router — pages never render it)

Phone (< 768): content + fixed bottom tab bar 今日 · 练习 · 记录 · 依据 (49 + safe-bottom). Tablet (768–1023): compact rail 80 (seal, four items, 求助方式, 设置). Desktop (≥ 1024): rail 240 (lockup, four items, 求助方式, 设置, the offline caption). One `<main id="main">` holds the page; a 「跳到正文」 skip link is the first focusable element on tablet and desktop. Current item: rail per DESIGN §8.12 (`/program/*`, `/pace-finder` → 练习; `/settings/*` → 设置; `/help` → 求助方式); on the tab bar 设置 counts as 今日 and `/help` has no current tab.

### 4.2 Page components

| Export | Props | What it does |
| --- | --- | --- |
| `PageFrame` | `title: string \| null`, `variant?: 'tabs' \| 'dock' \| 'bare'` (default `tabs`), `children`, `className?` | Side margins, safe-top, bottom space for the bar (DESIGN §8.0); sets `document.title` to 「title · 回神」 (null → 「回神」) and `<html data-bars>`: `tabs` → `tabs`, `dock` → `dock` (tab bar hidden, scroll padding for the dock), `bare` → `none`. **Every page renders exactly one PageFrame, with one `h1` inside, rendered immediately (not after data loads).** Tablet: padding 32 / 32 / 64 — the page keeps its own reading column of 640 (`var(--reading-max)`), or the 8-column grid on 记录 and 依据 (DESIGN §5.4). Desktop: padding 40 / 48 / 64, max 1104, left-aligned; the page lays out the 12-column grid |
| `NavBar` | `backTo: string`, `backLabel: string`, `actions?: ReactNode`, `className?` | Pushed pages: 「‹ 练习」 (44 high). If the previous page is `backTo`, it goes back in history (scroll restored); otherwise it navigates to `backTo`. No title in it — the h1 is in the content. Desktop: caption-size link above the h1 |
| `Masthead` | — | 今日 only: lockup (link to `/`, 「回神 · 今日」) + 设置 icon link; hidden on tablet/desktop (the rail has both) |
| `Dateline` | `date: Date` | 「10月22日 星期四」 + solar-term phrase (`lib/solar-terms`) under a 1 px ink rule |
| `Lockup` | `link?: boolean` (default true), `size?: 'default' \| 'large'`, `className?` | Seal + 回神. `large` (seal 24, 24 / 32) for `/welcome`; `link={false}` there |
| `Seal` | `className?` | The cinnabar seal alone |
| `PlayerFrame` | `name: string`, `children`, `embedded?: boolean` | §8.1 |
| `useDocumentBars(bars)`, `useDocumentTitle(page)`, `documentTitle(page)` | | Only for frames that are not PageFrame (rare) |
| `focusPageHeading(hash?)` | | Moves focus to `main h1` (or `#hash`); used by the shell |

Use `Dock` (`@/ui`) for docked bars (start bar, 「完成」) with `variant="dock"`; on desktop it is inline. A page without the tab bar must carry its own route to `/help` (DESIGN §8.17).

### 4.3 Focus, scroll, titles

- After every navigation (not the first load) focus moves to the new page's `main h1`; with a `#hash`, to that element, scrolled into view. Non-interactive targets get `tabindex="-1"` and `data-focus-target` and draw no focus ring (like sheet titles). Lazy pages are retried for ~1 s.
- `ScrollRestoration`: back/forward restores the position; a new page starts at the top.
- `document.title` per DESIGN §13.1 comes from `PageFrame title` / `PlayerFrame name`.

### 4.4 Theme and PWA

- 设置 › 外观 writes `prefs.set({ theme })`; `useThemeSync()` (in `RootLayout`) puts `data-theme` on `<html>` (`system` → no attribute; tokens follow `prefers-color-scheme`), keeps both `<meta name="theme-color">` in sync, and follows system changes. While a `PlayerFrame` is mounted the meta is `#121110`.
- `UpdatePrompt` (in `RootLayout`): when the service worker has a new version, one quiet toast 「有新版本」 + 「更新」, only while no session is in `checkin` / `playing` / `ending` / `summary` and the controller is idle or done. Never shown during a practice.
- Toasts: `useToast()` from `@/ui` (the host is mounted by `RootLayout`).

---

## 5. Services (`@/app/services`)

All are lazily created singletons.

| Function | Returns | Rules |
| --- | --- | --- |
| `getAudio()` | `AudioEngine` | **Call only inside a user-gesture handler** (click, key): previews, tests. The first call creates the engine; it creates its `AudioContext` on `unlock()`/`preview()`. Volumes follow `prefs.volume` automatically |
| `peekAudio()` | `AudioEngine \| null` | The engine if it exists; never creates one. Use it in effects and cleanups (`peekAudio()?.stopPreview()`) |
| `getController()` | `SessionController` | The one controller (`src/engine`). Read it through the hooks (§6). Call its actions from handlers: `pause()`, `resume()`, `end()`, `mark()`, `countTap('breath' \| 'ninth' \| 'reset')`, `stepBack()`, `skipSection()`, `breathAt(t)`, `time()`. **Never call `start()` or `reset()`** — the flows do (§7) |
| `peekController()` | `SessionController \| null` | |
| `getPlatform()` | `BrowserPlatform` | Wake lock, vibration, visibility (the controller already uses it) |
| `getRepo()` | `LocalSessionRepo` | The records repository (same one the data hooks read) |
| `setTimeScale(n)`, `getTimeScale()` | | Dev/e2e `?speed=N` only (§11) |
| `resetServices()` | | Tests only: drops every singleton and subscription |

---

## 6. Hooks (`@/app/hooks`)

| Hook | Returns | Notes |
| --- | --- | --- |
| `useSessionState()` / `useSessionState(selector)` | `SessionState` / `T` | `useSyncExternalStore` over the controller: re-renders only on session events (status, caption, section, marks, rate…). Selectors must return existing values, not new objects |
| `useSessionClock(onFrame, active = true)` | `void` | Calls `onFrame(controller.time())` on every animation frame while `active`; **no React state per frame** — for canvases (breath curve, box pacer). Stops in a background tab; resumes at the current time |
| `useSessionSecond(active = true)` | `number` | `Math.floor(controller.time())`, re-rendering once per second — for readouts (remaining = `state.endSec - second`) |
| `useResumeCountdown()` | `number \| null` | Seconds left (5, 4, … 1) while a resume countdown runs (§7.4), else `null` — the player shows 「准备」 + the figure |
| `usePendingSession()` / `usePendingSession(selector)` | `PendingSession` / `T` | The app-level context of this practice (§7.6) |
| `usePrefs(selector?)`, `useRecords()`, `useStats(now?)`, `useStorageMode()`, `useToday()` | | Re-exported from `@/data` (see modules.md) |

Remaining time: `endSec` is `null` for 不限时; during the lead-in `time()` is negative.

---

## 6a. Plan (`@/app/plan`) — pure functions

`buildPlan(practiceId, minutes, prefs, screening, overrides?) → SessionPlan` — used by the flows; pages normally need only the helpers:

| Export | Signature | Use |
| --- | --- | --- |
| `defaultMinutes` | `(id, { practice }, screening) → number` | The duration a start bar shows and starts: the last one chosen on the detail page (`prefs.practice[id].minutes`) if still allowed, else the (health-check adjusted) default |
| `fitMinutes` | `(requested, { durations, defaultMinutes }) → number` | A requested duration snapped to an allowed one |
| `afterQuestions` | `(id, { checkin }) → { feeling, checkin }` | What a summary may ask (not after bedtime sounds or the pace finder) |
| `isBedtime` | `(id) → boolean` | `sleep` and `body-scan-sleep` |
| `isOffered`, `V1_UNAVAILABLE` | `(id) → boolean`, `ReadonlySet` | v1 availability (§0) — re-exported from `@/content/practices` (one source) |
| `PACE_FINDER_RATES` | `readonly [6.5, 6, 5.5, 5, 4.5]` | Pace-finder steps; it **is** `PACE_FINDER_ASSESSMENT.rates` from `@/hrv`. `PACE_STEP_SEC` = 60 |
| `SLOW_RATE` | `{ min 4.5, max 7, step 0.5 }` | The 节律 slider; min/max are the engine's `SLOW_RATE_MIN`/`SLOW_RATE_MAX` (PRODUCT.md §2: 4.5–7.0 everywhere) |
| `BOX_PHASE_SEC` | `{ min 3, max 6, default 4 }` | The 每步 stepper (min/max from the engine's `BOX_PHASE_MIN_SEC`/`BOX_PHASE_MAX_SEC`); save with `prefs.setPractice('box', { phaseSec })` |

What `buildPlan` does (content-team requirements included): duration fitted to the allowed list (the pace finder always one 60 s step); `leadSec` = `prefs.leadIn` (override `leadSec`); paced pattern from overrides → `prefs.practice[id]` → `prefs.personalRate` → (health-check adjusted) default — slow: `{ rate, ratio }`, rate clamped to **4.5–7.0**, with the 90 s warm-up from 8 / min unless `overrides.warmup` → `prefs.practice.slow.warmup` turns it off, `rate: 'personal'` (四周呼吸 week 4); sigh: `{ cycle }`; box: `overrides.params.phase` → `prefs.practice.box.phaseSec` → 4 (clamped 3–6 s), or four explicit phases; pace finder: the step's rate (clamped 4.5–7.0) with the slow ratio the person will practise (`prefs.practice.slow.ratio` → the slow default `long`); timeline from `buildTimeline(script, minutes, { level, prosody, endBufferSec: 5 for 1-minute scripts })` — engine default 3.6 chars/s (there is no voice rate), the user's guidance level always passed (the health check can force 详细); `cues` false for 一分钟停一停 and bedtime; `captionCue` = `prefs.captionCue` when there is a timeline, not at bedtime, not for sound; `voice` always `false`; `bells` = `prefs.bells` (设置 › 钟声: start and end bells; the ending shape is unchanged); bedtime (`settle` prosody, no end bell, 20 s fade-in, sleep sound mode); interval bells for 静坐计时 (`prefs.intervalBell`, override `intervalBell`); sound mix from `prefs.sounds[mode]` (听声音) or the practice's remembered/default sounds with `prefs.volume`, filtered by mode (no birds at night); `params` for the record (`rate`, `ratio`, `cycle`, `inhale…holdOut`, `level`, `interval`, `mode`, `step`, plus `program` / `programDay` added by the start flow).

`PlanOverrides`: `{ params?, sound?, guidance?, warmup?, intervalBell?, leadSec? }`. `params` has the shape of `TodayPick.params` / programme items: slow `{ rate: number | 'personal', ratio }`, sigh `{ cycle }`, box `{ phase }`, pace finder `{ rate, step }`.

---

## 7. Flows (`@/app/flows`)

### 7.1 Starting — `startPractice(opts): StartOutcome`

**Call it synchronously inside the click/key handler** (the browser unlocks audio only in a gesture). Use the `StartButton` widget where a start bar or button is enough.

```ts
interface StartOptions {
  practiceId: CatalogPracticeId
  minutes?: number                 // default: defaultMinutes()
  overrides?: PlanOverrides        // e.g. { params: pick.params }
  from: 'today' | 'catalogue' | 'program' | 'hard-moment' | 'distress' | 'summary' | 'welcome' | 'player' | 'pace-finder'
  programDay?: { programId, day, role, countsAsDay }   // = TodayPick.plan
}
type StartOutcome = 'started' | 'gated' | 'checkin' | 'busy' | 'unavailable'
```

Order: not offered → `'unavailable'`; a session is in lead/running/paused → `'busy'`; first run (`prefs.safety.ackOn` is null) → the start is remembered in `sessionStore.gated`, navigate to `/welcome` → `'gated'`; pre check-in needed (`needsPreCheckin`: 练习前后自评 on, not a bedtime sound, not from `hard-moment` / `distress` / `pace-finder`, not grounding, and today's previous practice was not 很不舒服) → the shell's sheet opens over the current page → `'checkin'`; otherwise build the plan, `controller.start(plan)`, navigate to `/play/:id` (replace when already on `/play`) → `'started'`. `from: 'pace-finder'` never navigates.

- **Pre check-in**: rendered once by the shell (`PreCheckinHost` → `PreCheckinSheet`); pages do nothing. A score starts the practice 300 ms later (`CHECKIN_SEEN_MS`); 跳过 / Esc / scrim / drag start it without a score. The score is stored on the record as `checkin.pre`.
- **First run**: `/welcome` opens 开始之前 at once when `sessionStore.getState().gated` is set; 我已读完 calls `confirmSafetyNotice()` **in the click** — it stores `prefs.onboarded` and `safety.ackOn`, then starts the gated practice (or 一分钟停一停 when the person came to `/welcome` directly). 「看看全部练习」 sets `prefs.onboarded = true`, clears `gated` and goes to `/practices`.
- **Again**: `practiceAgain()` (summary 「再来一次」, in the click) starts the same practice and duration from `'summary'`; a programme day is not counted twice.

### 7.2 During a practice

The player calls the controller directly for pacing (`pause`, `resume`, `mark`, `countTap`, `stepBack`, `skipSection`) and these flows:

| Function | When |
| --- | --- |
| `changeSessionSound(mix)` | Sound sheet in a player: applies now (`controller.setSound`) and remembers it as this practice's default |
| `setCueVolume(v)` | Third slider 提示音与钟声 (0–100) |
| `rememberSound(practiceId, mix)` | Detail / sound pages outside a session: 听声音 → `prefs.sounds[mode]`; other practices → `prefs.practice[id]` + `prefs.volume` |
| `resumeAfterLeadIn()` / `cancelResume()` | §7.4 |
| End with the end dialog | `getController().end()` (during the lead-in: end without a dialog; nothing is recorded and the person returns to where they started) |

### 7.3 不舒服？ (DESIGN §8.15.17)

| Function | Behaviour |
| --- | --- |
| `pauseForDistress()` | Call before opening the sheet: pauses (and cancels a resume countdown) |
| `continueAfterDistress()` | 继续: resumes after the lead-in countdown (§7.4) |
| `endFromDistress()` | 结束练习: ends at once, no dialog; recorded if ≥ 60 s; the summary asks only 练完感觉 |
| `startGroundingFromDistress()` | 60 秒落地练习: ends this session quietly (recorded if ≥ 60 s, no summary) and starts `grounding` (from `'distress'`), replacing `/play/:id`; its summary asks only 练完感觉 |

Closing the sheet by scrim / Esc / drag keeps the practice paused (the player then shows the pause panel). The `DistressSheet` widget wires all of this by default.

### 7.4 Resume after a lead-in

`resumeAfterLeadIn()` — the engine's `resume()` continues mid-breath; DESIGN asks for a countdown first. It keeps the session paused for `plan.leadSec` seconds (`prefs.leadIn`; 0 → immediately), sets `sessionStore.resumeAt`, then resumes. `useResumeCountdown()` gives the seconds to show. A pause, end, another resume or leaving the player cancels it (`cancelResume()` is also exported). The pause panel's 继续 resumes at once (`getController().resume()`) unless design decides otherwise.

### 7.5 Finishing

On `controller.onFinish(result)` the flows:

1. build the record with `resultToRecord(result, { checkin: { pre } })` and save it when `practicedSec ≥ 60` (`MIN_RECORD_SEC`); pace-finder steps are never saved here (§8.4);
2. complete the programme day (`prefs.completeProgramDay`) when the start had `programDay.countsAsDay`, the practice completed and was recorded;
3. remember the slow-breathing rate after 有点急 (`finalRate` rounded to 0.5, 4.5–7.0; 有点急 itself stops at 7.0) into `prefs.practice.slow.rate` and `prefs.personalRate` — not when the rate was prescribed (四周呼吸, the light slow pace);
4. set `summary` and `phase`: completed → `'ending'` for `ENDING_HOLD_MS` (3 s; the stage stays, DESIGN §8.15.14) → `'summary'`; ended early → `'summary'` at once; ended during the lead-in (`practicedSec ≤ 0`) → no summary, back to `origin`.

`SessionSummary` (`usePendingSession(s => s.summary)`):

| Field | Meaning |
| --- | --- |
| `result: SessionResult` | From the engine (`practicedSec`, `marks`, `count`, `breaths`, `finalRate`, `rateSteps`, `skipped`, `plan`) |
| `record: SessionRecord \| null` | `null` when < 60 s: show SUMMARY.notRecorded, no data, no questions, only 完成 |
| `questions: { feeling, checkin }` | What to ask. `feeling` false after bedtime sounds; `checkin` only when 练习前后自评 is on, the pre question was asked (answered or skipped), and not after 不舒服？ / grounding |
| `answers: { feeling?, post?, note? }` | Answers so far (`null` = skipped) |
| `gentler: boolean` | After the feeling is saved: 2 of the last 3 recorded feelings are 更紧张 / 很不舒服 (this one included) → show the gentler block |
| `programDayDone`, `rememberedRate` | For the summary's data lines |

Answer functions (call from handlers; each saves immediately): `submitFeeling(feeling | null)`, `submitCheckin(score | null)`, `submitNote(text)` (trimmed, ≤ `NOTE_MAX` = 200; on blur and before closing), `closeSummary()` (完成 and the close ×: back to `/`), `practiceAgain()`. 很不舒服 opens 先休息一下 — the summary page owns that sheet (its 60 秒落地练习 calls `startPractice({ practiceId: 'grounding', minutes: 1, from: 'distress' })`).

### 7.6 The pending session (`sessionStore`, Zustand vanilla)

`PendingSession`: `phase: 'idle' | 'checkin' | 'playing' | 'ending' | 'summary'`, `start: StartOptions | null`, `plan: SessionPlan | null`, `origin` (path the practice was started from), `pre` (0–10 or null), `preAsked`, `endedFromDistress`, `summary`, `gated`, `resumeAt`. Read it with `usePendingSession(selector)`; only the flows write it (tests may `sessionStore.setState` to set up a state).

### 7.7 Records snapshot

`latestRecords()` — the newest-first records the start flow uses synchronously (filled at boot); `unwellJustBefore(records, now?)`. Pages read records with `useRecords()` / `useStats()`.

---

## 8. Player contract

### 8.1 `PlayerFrame`

Full window, always dark: `data-theme="dark" data-surface="player"` on its root, `<html data-bars="player">` (tab bar and rail hidden, scroll padding for the controls), theme-color dark, a 900 ms fade-in from the app theme. Root element `<main aria-label="慢呼吸练习">` (`embedded` → `<section>` with the same label, for use inside AppFrame). Lay its children out as four regions, each with a `data-region` attribute: `hud`, `stage` (flex 1), `readouts`, `controls`. The frame places them: phone column; landscape phone (height < 500) stage left 55 %, the rest right 45 %; tablet and desktop a centred 640 column. Full-bleed figures (the breath curve) handle their own negative margins (`components.css` `.curve`).

### 8.2 `/play/:id` (`PlayerRoute`)

- `phase` `checkin` / `playing` / `ending` (or idle) → `<PlayerFrame name>` + `<PlayerPage practiceId>`; `phase === 'summary'` → AppFrame (rail on desktop, no tab bar on phone) + `<SummaryPage />` with a 900 ms fade back to the app theme; focus moves to the summary's h1.
- The practice shown is the active one (`sessionStore.start.practiceId`) or, for a deep link or reload, `:id` (unknown or not offered per `isOffered` from `@/content/practices` → 404).
- **Deep link / reload**: no session is running (`useSessionState().status === 'idle'` and `phase !== 'playing'`). Show a large 开始 that calls `startPractice({ practiceId, from: 'player' })` in its click — `StartButton` does this. Never auto-start.
- Unmounting the route ends a running session (`abandonPractice()`): recorded if ≥ 60 s, no summary.
- `PlayerPage` props: `{ practiceId: CatalogPracticeId }`. `SummaryPage`: no props; it reads `usePendingSession(s => s.summary)` and renders `<PageFrame title={SUMMARY.title} variant="dock">`.

### 8.3 What the player reads

`useSessionState()` for status, `timeline`（跳过后已提前的实际时间线）, caption (the text guidance), section, marks, count, rate, `endSec`, `audio` (`'blocked'` → the audio toast with 再试一次: call `getController().retryAudio()` in its click; it unlocks and rejoins the audio clock without restarting or losing progress), `silentEnding`; `useSessionClock` for canvases; `useSessionSecond` for readouts; `usePendingSession(s => s.plan)` / `state.plan` for the plan; `useResumeCountdown()`. Keyboard handling, sheets and the end dialog belong to the player (DESIGN §8.15).

- **Text guidance** (PRODUCT.md §5): `state.caption` is `{ text, section, t, dur } | null`. Show `text` large in the centre (the main thing on the screen) and `section` as the section name. It stays until the next line replaces it (a new section clears it to `null`); after it has been read — `time() > t + dur` plus a linger of a few seconds — fade it slowly (frame clock, no React state per frame). The soft tone before a line that follows ≥ 20 s of quiet is played by the engine (`plan.captionCue`); the player plays nothing.
- **Paced practices with an intro script** (slow, cyclic sigh, box): the pacer stops when the closing lines begin (`plan.timeline.closingT`): the phase in progress finishes, then `getController().breathAt(t)` returns `null`, `state.phaseIndex` is `-1`, and there are no more glide / ping cues, bed breathing or vibrations. Stop drawing the curve, the 吸 / 呼 label and the phase countdown at the first `null` (the future dashed curve ends there too); the closing caption (「最后这一会儿，不用再跟着节拍……」) is then the stage. `state.rate` keeps the last rate.

### 8.4 Pace finder (`/pace-finder`)

Each step is a 60 s session started from the page, inside the rating tap or the start bar click:

```ts
startPractice({
  practiceId: 'pace-finder', from: 'pace-finder',
  overrides: { params: { rate: PACE_FINDER_RATES[i], step: i + 1 }, ...(i > 0 ? { leadSec: 3 } : {}) },
})
```

It does not navigate, save a record or show a summary: when a step ends, `phase` returns to `'idle'` and `summary.result` holds the step's result. Render the run with `<PlayerFrame name={…} embedded>` (navigation collapses, the frame fills the window). After the last step (or when stopped) save the run once with `savePaceFinderRun(results, { chosenRate?, hrv? })` (one record, ≥ 60 s), and on 「设为慢呼吸的节律」 write `prefs.setPractice('slow', { rate })` and `prefs.set({ personalRate: rate })`.

---

## 9. Widgets (`@/widgets/<Name>`)

First implementations by the app shell; the player engineer refines DistressSheet, StopGuidance, FeelingChoice, CheckinScale, PreCheckinSheet and SoundPicker, the settings engineer HelpNumbers. Keep the props stable (or update every call site).

| Widget | Props | Behaviour |
| --- | --- | --- |
| `DistressSheet` | `open`, `onClose()`, `onContinue?` (default `continueAfterDistress`), `onEnd?` (default `endFromDistress`), `onGrounding?: (() => void) \| null` (default `startGroundingFromDistress`; `null` hides 60 秒落地练习 — the grounding player) | The 不舒服？ sheet on the player surface (DESIGN §8.15.17): STOP_GUIDANCE.short, the first three `after` items with 「停止指引全文 ›」 (`/help#stop`), the emergency line with `tel:` links, 60 秒落地练习, the dial grid, footer 结束练习 · 继续. The caller pauses first (`pauseForDistress()`); `onClose` (scrim, Esc, drag) must leave the practice paused |
| `StopGuidance` | `headingLevel?: 2 \| 3 \| null`, `ruled?`, `helpLink?`, `keys?: string` (fine-pointer only line), `id?`, `className?` | The full stop guidance in content order (pause panel, `/help#stop`, 设置 › 安全) |
| `HelpNumbers` | `variant?: 'grid' \| 'rows'`, `level?: 2 \| 3`, `className?` | `grid`: 「求助方式 ›」 head + 最后核实 + the four mainland numbers (sheets); `rows`: every region with PhoneRows + 最后核实 (`/help`, settings). Numbers are `tel:` links |
| `FeelingChoice` | `value: Feeling \| null`, `onChange(feeling \| null)`, `level?`, `className?` | 练完感觉: four one-tap cells, no preselection, 跳过 → `null` |
| `CheckinScale` | `value: number \| null`, `onChange(score \| null)`, `level?`, `className?` | 此刻有多紧张？ 0–10 in two rows, no preselection, 跳过 → `null`. Never shows the pre score |
| `PreCheckinSheet` | `open`, `onAnswer(score \| null)` | Mounted by the shell only (§7.1) |
| `SoundPicker` | `value: SoundMix`, `onChange(mix)`, `mode: 'relax' \| 'sleep'`, `onModeChange?` (shows 放松 · 睡前), `preview?` (preview a choice in the click; never inside a running session), `volumes?` (two sliders), `level?`, `className?` | Ambience list (none, nature, noise with its note) and music list as radio rows; sleep mode hides daytime-only sounds. Controlled: the caller saves (`rememberSound`, `changeSessionSound` or `prefs.set({ sounds })`) |
| `StartButton` | `StartOptions` + `variant?: 'startbar' \| 'button'`, `children?` (button label), `approx?` (「约 7 分钟」), `block?`, `onStarted?(outcome)`, `className?` | Calls `startPractice` in its click with the minutes it shows (`defaultMinutes` unless `minutes` is given) |

---

## 10. Data the flows write (for records, settings and tests)

- Record `params`: see §6a; programme starts add `program` and `programDay`.
- `checkin.pre` (start), `checkin.post`, `feeling`, `note` (summary).
- Prefs: `safety.ackOn` + `onboarded` (first run), `practice.slow.rate` + `personalRate` (有点急; 4.5–7.0), `practice[id]` sounds and `sounds[mode]` (sound choices), `volume.*`, `programs[id].done` (programme days).
- Prefs the settings and detail pages write (all in `Prefs` now; `buildPlan` reads them): `captionCue` (设置 › 文字引导 「新的一句出现时轻提示」, default on) · `bells` (设置 › 声音 › 钟声, default on) · `intervalBell` (间隔钟声, 0/5/10, default 0) · `practice.slow.warmup` (开头放慢, default on) · `practice.box.phaseSec` (每步秒数, 3–6, default 4). There are no voice prefs (`prefs.voice` was removed; stored old values are ignored).

---

## 11. Dev and test hooks

- **`?seed=demo`** (dev builds only): clears local data and writes 8 weeks of demo data through the real data APIs — the DESIGN §14.1 story moved to today (programme 八周正念 at week 3 day 2, this week Mon/Wed/Thu, focus with 回神 marks, 数息 with 数乱了 and invalid rounds, check-ins, feelings incl. 更紧张/很不舒服, notes, stopped-early sessions, weekly stress ratings, 练习前后自评 on). The parameter is removed from the URL afterwards.
- **`?speed=N`** (dev builds only): every session runs N× faster and silently (controller `timeScale`); the 3 s ending hold and resume countdowns scale too. It stays for the whole page load.
- Neither exists in production builds (`import.meta.env.DEV` + dynamic import of `src/dev/seed.ts`).
- **`?hrv=demo`** on `/pace-finder` (dev builds only): exposes the optional strap row with a simulated heart-rate device. Click connect to begin receiving simulated readings; the page still chooses a rate by comfort. Leaving the page disconnects the simulator. Production builds do not expose this switch.
- **Screenshots**: `node scripts/dev-shot.mjs <url> <out.png> phone|desktop|WxH [--dark] [--full] [--wait=ms]`, e.g. `http://localhost:<port>/records?seed=demo`.
- **E2E**: `playwright.config.ts` builds and previews production, where `?speed`/`?seed` do not exist. A spec that needs them runs against a dev server (`npx vite --port 4173 --strictPort` first; `reuseExistingServer` picks it up) or must tolerate real time (as `e2e/smoke.spec.ts` does). Seed a returning user with `localStorage['huishen.prefs.v1'] = '{"v":2,"onboarded":true,"safety":{"ackOn":"2026-10-01"}}'` in `addInitScript`.
- **Unit tests**: `setSessionRepo(createMemorySessionRepo())`, `prefsStore.getState().reset()`, `resetServices()`, `setNavigate(vi.fn())`, `initFlows()` (call its return in `afterEach`); `sessionStore.setState({...})` for summary states. Vitest runs without globals: call `cleanup()` from Testing Library in `afterEach`. Prefer roles and accessible names; `data-testid` only for canvases.

---

## 12. Strings still pending in content

Used as `TODO(content)` constants in `src/app/strings.ts` and `src/widgets/SoundPicker`: 「主导航」, 「练习控制」, 「回神 · 今日」, the rail caption 「离线可用。练习记录只保存在这台设备上。」, 「跳到正文」, the player landmark 「{练习名}练习」, and 「声景」 (sound-picker group name). Replace them with content keys once they exist.
