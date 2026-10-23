# 回神 · Core modules (modules.md)

The public API of the four core modules — `src/engine`, `src/audio`, `src/data`, `src/hrv` — and how the app layer wires them together.
Version 1.1 · 2026-10-24 (no-voice pivot: text guidance, caption cue, pacer stop at the closing, 4.5–7.0 rate range, new prefs).

Reading order: `docs/PRODUCT.md` (what) → `docs/design/DESIGN.md` (how it looks) → **this file** (module APIs) → `docs/APP.md` (how the app uses them).
The JSDoc in the code is the detail; this file is the map. If the two disagree, the code is right and this file needs fixing — report it.

Import from the module entry points: `@/engine`, `@/audio`, `@/data`, `@/hrv`. Shared helpers (dates, maths, ids, formatting) live in `@/lib/*`; do not copy them into a module.
Dependency direction: `lib ← content ← engine ← (audio, data, hrv) ← app ← features`. `audio`, `data` and `hrv` may use engine types, constants and pure functions; the engine never imports them (it talks to sound, voice and the device through ports).

**v1 has no voice guidance** (PRODUCT.md §0): guided practices are text-guided. The timeline's lines become on-screen captions; a line that follows ≥ 20 s of quiet gets a very soft `caption` cue. There is no speech synthesis anywhere in the app (the old `speechSynthesis` voice guide is deleted); the engine keeps its `VoicePort` and the audio engine keeps `setDuck` for future human recordings.

---

## 0. The wiring in one picture

```
 Practice (content) + Prefs (data) + overrides
        │  buildPlan()                          src/app/plan.ts
        ▼
   SessionPlan ──controller.start(plan)──▶ SessionController (engine)
                                              │ AudioPort    → AudioEngine (audio)
                                              │ VoicePort    → NULL_VOICE in v1 (kept for future recordings)
                                              │ PlatformPort → createBrowserPlatform() (engine)
                                              ▼
   UI: getState()/subscribe() for events, time()/breathAt() per frame
                                              │ onFinish(result)
                                              ▼
   SessionResult ──resultToRecord()──▶ SessionRecord ──repo.add()──▶ IndexedDB (data)
                                              │
                         useRecords() / useStats() → computeStats() → Records, Today
```

The app creates everything once, lazily, in `src/app/services.ts`:

```ts
const audio = createAudioEngine()           // AudioEngine = AudioPort + preview / warm / duck / dispose
const platform = createBrowserPlatform()    // wake lock, vibration, visibility
for (const bus of ['master', 'ambience', 'music', 'cues'] as const) audio.setVolume(bus, prefs.volume[bus])
const controller = createSessionController({ audio, voice: NULL_VOICE, platform })   // v1: no voice
```

Rules that keep this working:

- **One controller for the whole app.** Between practices call `controller.reset()`; never create a second controller.
- **Create and unlock sound inside a user gesture.** `controller.start(plan)` calls `audio.unlock()` synchronously, so call it from the click handler (`startPractice()` does). The app hands the controller a forwarding port so the `AudioEngine` itself is only built on the first gesture.
- **v1 has no voice guidance**: every plan has `voice: false` and the controller gets `NULL_VOICE` (`{ available: () => false, speak() {}, cancel() {} }`). There is no voice service, no voice preference and no duck wiring.
- **Pages never touch the engine or `AudioContext` directly**; they go through `@/app/services`, `@/app/flows` and `@/app/hooks`.

---

## 1. Engine — `@/engine`

Framework-free session engine: breathing patterns, guided timelines, clocks, scheduling and the session state machine. Contracts are in `src/engine/types.ts`.

### 1.1 Session controller

`createSessionController(ports: SessionPorts, options?: SessionOptions): SessionController`

- `SessionPorts = { audio: AudioPort; voice?: VoicePort; platform: PlatformPort }` — `voice` defaults to `NULL_VOICE` (exported, frozen, silent). The app passes `NULL_VOICE` explicitly.
- `SessionOptions = { timeScale?, perfNow?, setInterval?, clearInterval?, setTimeout?, clearTimeout? }` — `timeScale ≠ 1` runs on the performance clock **without sound** (dev `?speed=N` and e2e only); the timer and clock hooks are for tests.

| `SessionController` member | Purpose |
| --- | --- |
| `start(plan): Promise<void>` | Unlock sound (≤ 3 s wait), then begin: countdown (`lead`) → `running`. Ignored while another session is active. Rejects with `RangeError` for an invalid plan. Call in a user gesture. |
| `getState(): SessionState` / `subscribe(fn): () => void` | Coarse snapshot that changes only on events (status, phase index, caption, section, rate, marks, count, `endSec`, `audio`). Use with `useSyncExternalStore` (`useSessionState`). `timeline` is the current, skip-adjusted timeline (fall back to `plan.timeline` for older snapshots). `caption` is `{ text, section, t, dur } \| null` (see below). |
| `time(): number` | Practice seconds; negative during the countdown, frozen while paused, capped at the end. Read per frame (`useSessionClock`), never store in React state. |
| `breathAt(t): PatternPoint \| null` | Paced practices: position at practice second `t` including warm-up and any 有点急 change (also ones scheduled but not yet in effect). Draw the past solid, the future dashed. Still answers after the finish until `reset()`. **Pacer stop:** for a paced practice with an intro script, no new breath phase starts once the closing lines begin (`Timeline.closingT`); the phase in progress finishes and from that moment (`paceEndAt`) `breathAt` returns `null` — stop drawing the curve, the 吸 / 呼 label and the phase countdown there. Without closing lines the pacer runs to the end as before. |
| `pause()` / `resume()` | Suspends and resumes the audio context; the clock stops with it. |
| `end()` | Stop early. Also cancels a start that is still waiting for the unlock. An unlimited session (`plannedSec: 0`) ended this way counts as `complete`. |
| `mark()` | Focus: one 回神 (debounced 0.6 s; plays the `mark` cue when `plan.cues`). |
| `countTap('breath' \| 'ninth' \| 'reset')` | Breath counting. Ninth taps that average < 1.5 s per tap count as `invalid`. |
| `stepBack()` | Slow breathing 有点急: from the next cycle (≥ 0.3 s away) +0.5/min, up to `STEP_BACK_MAX_RATE` = **7.0** (`SLOW_RATE_MAX`, PRODUCT.md §2), the rest of the warm-up dropped, kept to the end. During the warm-up cycles faster than 7 (8, 7.5/min) it never slows the pace down: the warm-up continues to 7.0 and then **holds 7.0** (the rest of the warm-up is dropped). Running + `pattern.type === 'resonance'` only, and only if it takes effect before the pacer stops. |
| `skipSection()` | Guided 跳过这一处: the next section starts now and the whole practice ends correspondingly earlier (`state.endSec` moves). Only when `state.section.skippable`. |
| `setSound(mix: Partial<SoundMix>)` | Change the bed or its volumes mid-session (cross-fades; `state.plan.sound` follows). |
| `retryAudio()` | After blocked audio, unlock in a new user gesture and rejoin the sound clock at the current time without losing progress. Does not resume a paused practice or resurrect one that ended during the retry. |
| `reset()` | From `done` back to `idle`. |
| `onFinish(fn): () => void` | Called **once** per session with a `SessionResult` (complete or stopped). |

`SessionResult`: `plan`, `startedAt` (ISO), `practicedSec` (a natural finish counts the full, possibly skip-shortened, length), `completed`, `marks`, `count: CountState | null`, `breaths` (completed cycles incl. warm-up, counted until the pacer stops), `finalRate` (last steady rate, after 有点急), `rateSteps`, `skipped` (section ids).

`SessionState.caption` (`Caption`): `text`, `section` (section title or `null` for opening and closing lines), `t` (the practice second the line appeared — its timeline time, shifted after a skip) and `dur` (estimated seconds to read it, without the pause after it). A caption stays until the next line; a `section` cue clears it; the finish clears it. The engine never clears it on a timer: the player fades it from `t + dur` plus a linger (PRODUCT.md §5). `phaseIndex` is `-1` after the pacer stops.

**Caption cue** (`plan.captionCue`): when a `speak` line follows ≥ `CAPTION_CUE_GAP_SEC` (20) s of quiet, `audio.cue('caption', at)` is scheduled ahead (look-ahead, so it is exact and works in a background tab). Quiet is measured from the previous line's estimated end (`t + dur`); the practice start (start bell), timeline `chime`s and — when `plan.cues` — section chimes also break the quiet, so the first line right after a section chime gets no second tone. The first line also qualifies when it follows ≥ 20 s of quiet. Never for `kind: 'sound'` and never without sound. `captionCueTimes(timeline, sectionChimes)` returns the qualifying line times (pure; the UI may use it).

`CountState`: `current`, `cycles` (= `correct + errors + invalid`), `correct`, `errors`, `resets`, `invalid`. Accuracy = `correct ÷ (correct + errors + resets)`; `invalid` cycles are left out of both (`countAccuracy` in data).

Helpers the UI may use: `leadFor(plan, audioOn)` — the countdown actually used (≥ 3 s when there is a bed and a start bell; no stretch when `plan.bells === false`; draw the countdown with it); `endingOf(end, silentEnd, endBell, bells = true)` — where the end bell, the bed fade and the silent ending fall (`bell: null` when `bells` is false; the fade and silent ending are unchanged); `captionCueTimes(timeline, sectionChimes)`; `paceEndAt(pace, closingT, end)` (pace.ts). Timing constants (`DEFAULT_FADE_IN_SEC` 8, `SILENT_END_*`, `NO_BELL_FADE_SEC` 120, `MARK_DEBOUNCE_SEC`, `COUNT_MIN_TAP_INTERVAL_SEC`, `CAPTION_CUE_GAP_SEC` 20, …) and `NULL_VOICE` are exported from `session.ts`.

### 1.2 `SessionPlan`

| Field | Meaning |
| --- | --- |
| `practiceId`, `kind`, `title` | From the practice catalogue. |
| `plannedSec` | Practice seconds, excluding the countdown; `0` = unlimited (sound only), runs until `end()`. |
| `leadSec` | Countdown; the engine stretches it to ≥ 3 s when a bed and a start bell are both present. |
| `pattern` | Paced practices: `BreathPattern` (see 1.3), usually `withWarmup(buildPattern(params))` for slow breathing. |
| `timeline` | Guided practices, and paced practices with an intro script (slow, cyclic sigh, box): `buildTimeline(script, minutes, opts)` (see 1.4). With a `pattern`, `timeline.closingT` is where the pacer stops (see `breathAt`). |
| `intervalSec` | Timer: interval bell period, or `null`. |
| `sound: SoundMix` | Ambience + music + their volumes (+ `mode`). |
| `cues` | 回神 / counting / section cues. Paced cues follow `cueStyle` instead. |
| `captionCue` | **New, required.** Soft `caption` cue when a line follows ≥ 20 s of quiet (设置 › 文字引导 「新的一句出现时轻提示」). Ignored for `kind: 'sound'`. |
| `voice` | Read the timeline aloud through the `VoicePort` (always `false` in v1; kept for future recordings). |
| `haptics` | Vibrate on phase changes (where supported). |
| `silentEnd` | Bed fades early and the end bell rings after silence (≥ 3 min: last 60 s, 30-s fade; 1–3 min: last 25 s, 15-s fade). |
| `params` | Recorded parameters (`rate`, `ratio`, `cycle`, `level`, `interval`, `mode`, …). |
| `cueStyle?` | `'glide'` (default) / `'ping'` / `'bed'` / `'off'`. |
| `endBell?` | Default `true`. `false` (bedtime): the bed fades over the last 120 s instead. |
| `bells?` | **New.** Default `true`. `false` (设置 › 钟声 off): no start bell and no end bell; the ending is otherwise unchanged (silent ending still fades and leaves the quiet; `leadFor` no longer stretches the countdown). Interval bells follow `intervalSec`. |
| `fadeInSec?` | Bed fade-in: 8 (default), 20 at bedtime. |
| `prosody?` | `'steady'` (default) or `'settle'` (bedtime: slower and softer towards the end); build the timeline with the same value. |

### 1.3 Breathing patterns

| Export | Purpose |
| --- | --- |
| `buildPattern(params: PacedParams): BreathPattern` | `sigh` / `resonance` / `phases` → one cycle of segments (`in`, `in2`, `hold`, `out`, `rest`) with easing and labels. Throws `RangeError` outside `RATE_MIN`–`RATE_MAX` (3–10/min, what the engine can lay out), `SIGH_CYCLE_MIN`–`MAX` (6–20 s), phases ≤ 20 s. |
| `SLOW_RATE_MIN` 4.5 · `SLOW_RATE_MAX` 7 | **The slow-breathing range** (PRODUCT.md §2) used everywhere: detail slider (`SLOW_RATE` in plan.ts), plan building, prefs sanitizing (`PERSONAL_RATE`, `practice.slow.rate`), pace-finder results and the 有点急 cap. |
| `BOX_PHASE_MIN_SEC` 3 · `BOX_PHASE_MAX_SEC` 6 | Box breathing seconds per step (default 4); `prefs.practice.box.phaseSec` and `BOX_PHASE_SEC` use them. |
| `withWarmup(p, startRate = 8): BreathPattern` | Slow breathing only: start at 8/min and slow by 0.5/min every 2 cycles to the target; the time counts as practice. Other types are returned unchanged. |
| `atRate(p, rate)` · `warmupSec(p)` | Same proportions at another rate (no warm-up) · seconds the warm-up takes. |
| `patternAt(p, t): PatternPoint` | Position at second `t` (y, segment, index, remaining, progress, cycle). The controller's `breathAt` adds 有点急 on top. |
| `cyclesOf(p)` · `cycleAt(p, t)` · `completedCycles(p, t)` | Cycle spans (start, length, rate). `hrv` uses `cyclesOf` for cycle boundaries. |
| `describePattern(params): string` | One-line description, e.g. 「吸 4.5 秒，呼 6.5 秒 · 每分钟 5.5 次」. |
| `ease(kind, q)` | The easing all consumers share — canvas, haptics, and the audio bed and glide (`src/audio/automation.ts` imports it). |
| `paceOf`, `paceAt`, `paceCycleAt`, `paceCycles`, `paceBreaths`, `paceTarget`, `paceSteps`, `stepBack`, `paceEndAt` | The actual tempo of a run as consecutive pieces (warm-up, 有点急). Used by the controller; exported for tests and summaries. `STEP_BACK_RATE` 0.5, `STEP_BACK_MAX_RATE` 7 (= `SLOW_RATE_MAX`), `STEP_BACK_LEAD_SEC` 0.3. `paceEndAt(pace, closingT, end)` — where the pacer stops: the end of the phase in progress at `closingT` (or `closingT` itself on a phase boundary), never after `end`; `end` when `closingT ≥ end`. |

### 1.4 Guided timelines

`buildTimeline(script: GuidedScript, minutes: number, opts?: TimelineOptions): Timeline` lays a script (from `@/content/scripts`) out over `minutes` (clamped to the script's range; `duration = minutes × 60`). In v1 the lines are on-screen text; the timing is the meditation-guidance speaking pace (3.6 chars/s), which future recordings will follow too. Lines (each over its own `dur`) never overlap and never cover the end bell.

When the lines do not fit (slow pace, long content) it trims in this order (`trimToFit`): (1) compress the silences, then give up the end buffer; (2) drop long-version-only sections (`omitAtOrBelow`, highest threshold first — extra content of the longer length, like `minMinutes` lines; content's `droppableWhenSlow` relies on it); (3) drop all `detailed` lines, then all `standard` lines (each level is written as a set; spacer lines go with the line they push); (4) shrink written pauses (`ScriptLine.pause`, incl. spacer lines) proportionally, just enough; (5) drop the remaining sections from the end, re-widening the pauses after each; (6) last resort: compress all speech time proportionally (captions come faster). **Core opening and closing lines are never dropped.**

`TimelineOptions`: `level` (`'quiet' | 'standard' | 'detailed'`; default = every line), `prosody` (`'steady' | 'settle'`), `charsPerSecond` (default 3.6; the app passes none), `endBufferSec` (default 10).

`Timeline = { duration, cues: TimelineCue[], sections: TimelineSection[], closingT? }` — cues are `speak` (`text`, optional `say`, `rate`, `volume`, and **`dur`**: estimated seconds to read the line without the pause after it — always set by `buildTimeline`), `section` (id, title) and `chime`; sections carry `t0`, `t1`, `skippable`. **`closingT`**: the time the first closing line appears (`duration` when there are none; always set by `buildTimeline`, optional in the type for hand-written timelines, which count as having no closing). A skip shifts it with the rest.

Also: `measureScript(script, minutes, opts)` (content checks: does a script fit its shortest length), `lineIncluded(line, minutes, level)`, `lineSec` (reading + pause), `readingSec(line, cps)` (reading only), `speakSec(cue)` (a cue's `dur`, or an estimate at 3.6 chars/s when a hand-written cue has none), `spokenChars`, `pauseAfter`, `settleTone(q)`.

### 1.5 Platform, clocks, scheduler

- `createBrowserPlatform(doc = document, device = navigator): BrowserPlatform` — `keepAwake(on)` (screen wake lock, re-acquired when the page returns), `vibrate(pattern)` (no-op where unsupported), `hidden()`, `onVisibilityChange(fn)`, `dispose()`.
- `createAudioClock(source, origin, perfNow)`, `createPerfClock({ perfNow, start, timeScale })` — session clocks (audio clock when sound is on, falls back to the performance clock if the browser blocks sound).
- `createTicker(fn, timers)`, `createLookahead(...)`, `TICK_MS` 200, `HORIZON_VISIBLE_SEC` 6, `HORIZON_HIDDEN_SEC` 75 — the look-ahead scheduler (internal; exported for tests).

### 1.6 Ports

`AudioPort`, `VoicePort`, `PlatformPort` are the only way the engine reaches the outside world. `VoicePort` stays for future human recordings; v1 passes `NULL_VOICE`. Fakes for tests are in `src/test/fakes` (`FakeAudioPort`, `FakeVoice`, `FakePlatform`, `createTestSession`, plan builders `testPlan` (all options on, incl. `captionCue: true`), `slowPlan`, `guidedPlan`, `soundPlan`).

---

## 2. Audio — `@/audio`

Real-time synthesis with Web Audio: soundscapes and generative music (assets generated in a Worker with fixed seeds), cues and bells, a true-peak limiter in an AudioWorklet (−3 dBTP), calibrated loudness (relax −23 LUFS, sleep −28 LUFS).

### 2.1 `createAudioEngine(options?: AudioEngineOptions): AudioEngine`

`AudioEngine` implements `AudioPort` (what the controller uses) plus app-level extras:

| Member | Purpose |
| --- | --- |
| `unlock(): Promise<boolean>` | Create or resume the `AudioContext` (in a gesture); loads the limiter worklet. `true` if sound can play. |
| `now()` · `state()` · `onStateChange(fn)` | Audio clock; `'running' \| 'suspended' \| 'closed' \| 'interrupted' \| 'unavailable'`. |
| `setVolume(bus, 0–100)` | `master`, `ambience`, `music`, `cues`; perceptual curve. A bed's `SoundMix.ambienceVolume` / `musicVolume` set the same two buses when it starts or changes. |
| `startBed(mix, at, fadeIn, plannedSec?)` · `changeBed(mix)` · `fadeBedOut(at, dur)` · `stopBed(fade)` | The background bed (called by the engine). |
| `breath(seg, at)` · `glide(seg, at)` · `freeRun(until)` | Breath-following bed brightness, the 滑音 tone, free slow movement (called by the engine). |
| `cue(kind, at?)` · `bell(kind, at)` · `cancelScheduled()` | One-shots and bells; cancel everything not yet sounding (called by the engine). |
| `suspend()` · `resume()` | Pause with a fade; resume fades back in. |
| `setDuck(on)` | Lower ambience and music by 8 dB while a voice plays (0.3 s down, 1.5 s up). Unused in v1; kept for future human recordings. |
| `preview(mix, seconds = 7)` · `stopPreview()` · `previewing()` · `onPreviewChange(fn)` | Try a sound when idle (gesture). Not during a practice. |
| `warm({ ambience, music })` | Pre-generate a mix's assets while idle so `start` does not wait. |
| `dispose()` | Stop everything and close the context. |

`AudioEngineOptions` (`createContext`, `store`, `rng`, `visibility`, `loadLimiter`) exist for tests and the labs; the app passes none.

### 2.2 No voice guide

The `speechSynthesis` voice guide (`createVoiceGuide`, `VoiceGuide`, `DEFAULT_RATE`, `RATE_RANGE`, `src/audio/voice.ts`) was **deleted** with the no-voice pivot. Do not add device or online speech (AGENTS.md §3).

### 2.3 Values and types

`AMBIENCE_IDS`, `MUSIC_IDS`, `volumeGain(v, bus)`; types `AmbienceId` (`none rain stream ocean forest birds wind pink brown`), `MusicId` (`none drone pentatonic phasing`), `SoundMode` (`relax | sleep`), `SoundMix`, `Bus`, `CueKind`, `BellKind`, `Scheduled`, `PreviewState`, `AudioEngine`. Which sounds a mode allows (no birds at bedtime) is decided by `fitMix` in `@/content/sounds`.

`CueKind` = `in in2 hold out rest mark tap ninth section` + **`caption`**: the new-line cue of text guidance — a very soft, short, warm tone on F♯4 (369.99 Hz; 35 ms raised-cosine attack, weak partials ×2/×3, each decaying with τ = 0.22 s ÷ partial, ≈ 0.5 s audible, no ring), clearly unlike the bright, long-ringing section chime (D5, 3 ms attack, T60 11 s) and the 8 ms-attack breath pings; above the glide's range (A3–E4), so it never blends into the pacer, and high enough for phone speakers. Level `LEVELS.cues.caption` = −8 LU against the bed target (section −3, mark −5); the offline QA checks it like every cue (`cue/caption`).

Dev tools: `audio-lab.html` (offline QA, live smoke, calibration; every cue incl. `caption` has a try button, plus a manual 「人声压低」 toggle) and `session-lab.html` (§6); `npm run test:audio` runs both in Chrome. The offline QA's default relax preset is `SOUND_PRESETS.relax` (stream, no music) and must land at −23 LUFS ±1 (`preset/默认放松`).

---

## 3. Data — `@/data`

Records in IndexedDB (falls back to localStorage, then memory), preferences in localStorage (Zustand), statistics, export/import, calendar reminders. No React outside `hooks.ts`.

### 3.1 Records

| Export | Purpose |
| --- | --- |
| `resultToRecord(result: SessionResult, extras?: RecordExtras): SessionRecord` | Engine result → validated record: local `date`, whole-second `actualSec`, `sound` (+ `mode` for sound practices or when the plan names one), `params`, `marks` (always for focus), `count` (incl. `invalid`), `breaths`, `rate` (= `finalRate`, so 有点急 shows; the planned rate stays in `params`), `rateSteps`, `skipped`. `extras`: `checkin`, `hrv`, `feeling`, `note`. |
| `isRecordable(result)` · `MIN_RECORD_SEC` (60) | Only practices of ≥ 1 minute are saved. |
| `sanitizeRecord(raw): SessionRecord \| null` | Validate anything read or imported (bad identity → dropped; bad minor fields → repaired or removed). |
| `byStartedAt(a, b)` | Stable chronological sort. |

`SessionRecord` fields: `v`, `id`, `practiceId`, `kind`, `startedAt`, `date`, `plannedSec`, `actualSec`, `completed`, `sound`, `params`, `marks?`, `count?`, `breaths?`, `rate?`, `rateSteps?`, `skipped?`, `checkin?: { pre?, post? }`, `feeling?: 'calmer' | 'same' | 'tenser' | 'unwell'`, `hrv?: { meanHr?, rmssd?, amplitude? }`, `note?`.

### 3.2 Repository

`getSessionRepo(): LocalSessionRepo` — the shared repository (the hooks and the app use the same one). `createSessionRepo(options?)`, `createMemorySessionRepo()` (tests, demos), `setSessionRepo(repo | null)`, `storageMode()`.

`SessionRepo`: `all()` (newest first), `add(record)`, `update(id, patch)` (shallow merge, `undefined` deletes; `checkin` merges `pre` and `post` separately), `remove(id)`, `clear()`, `importMany(records)` (dedupe by id → `{ added, skipped }`), `subscribe(fn)` (also fires for other tabs). `LocalSessionRepo` adds `storageMode()` (`'indexeddb' | 'local' | 'memory'`), `ready()`, `close()`.

### 3.3 Preferences

`prefsStore` (Zustand store, persisted under `PREFS_KEY`, synced across tabs), `getPrefs()`, `createPrefsStore(options?)`, `DEFAULT_PREFS`, `sanitizePrefs(raw)`, `sanitizePracticePrefs(raw)`, `pickPrefs(state)`.

Actions (`PrefsActions`): `set(patch)` (nested objects merge; invalid values are ignored), `setVolume(bus, 0–100)`, `setPractice(id, patch)`, `addStressRating(score, on?)`, `startProgram(id, on?)`, `completeProgramDay(id, 'w3d2', on?)`, `leaveProgram(id)`, `reset()` (everything), `resetSettings()` (settings only; keeps history, safety, reminders, programmes, personal rate).

`Prefs` holds: `theme`; `volume { master, ambience, music, cues }`; `guidance`; **`captionCue`** (default `true`; 设置 › 文字引导 「新的一句出现时轻提示」); `cueStyle`; `cues`; **`bells`** (default `true`; 设置 › 声音 › 钟声: start and end bells); `intervalBell` (0/5/10 min; 间隔钟声, default 0); `haptics`; `leadIn`; `silentEnd`; `checkin { prePost, feeling }`; `weeklyStress`, `stressRatings`; `sounds { relax, sleep }` (default mix per mode); `practice[id] { minutes, ambience, music, rate, ratio, warmup, cycle, phaseSec }`; `personalRate`; `onboarded`; `safety`; `reminders`; `programs`.

- **No `voice`** (removed with the no-voice pivot; `PrefsPatch` has no `voice` either). A stored `voice` object from an older version is ignored by the sanitizer and dropped on the next save. The format version stays `v: 2` (only optional fields were added or removed, no migration needed; the v1 → v2 migration is unchanged).
- `practice.slow.warmup` (boolean; absent = on): the 90-s warm-up from 8/min. `practice.box.phaseSec` (3–6 s, clamped with `BOX_PHASE_MIN_SEC`–`BOX_PHASE_MAX_SEC`; absent = 4).
- Rates come from the engine: `PERSONAL_RATE = { min: SLOW_RATE_MIN, max: SLOW_RATE_MAX }` (4.5–7.0). `personalRate` and `practice[id].rate` outside `RATE_MIN`–`RATE_MAX` (3–10) are treated as corrupt (dropped); inside, they are clamped into 4.5–7.0 (`practice.slow.rate` used to keep up to 10).

### 3.4 Statistics (Records and Today)

`computeStats(records, now): RecordStats` — everything the Records and Today pages show: `totals`, `today`, `week`, `weekDots`, `last7`, `month`, `calendar`, `consistency`, `heatmap`, `breakdown`, `focus`, `count`, `countSummary`, `checkin`, `checkinPoints`, `weekly { focus, count, checkin }`, `welcomeBack`, `recentDistress`. Minimum counts from the product spec are built in (trends stay empty until there is enough data), so the UI can render them as they come.

Individual functions: `totals`, `rangeSummary`, `weekSummary`, `recordsBetween`, `secondsByDay`, `heatmap(records, now, weeks = 8)`, `heatLevel`, `consistency`, `weekDots`, `monthCalendar(records, year, monthIndex, now?)`, `practiceBreakdown`, `daysSinceLast`, `welcomeBack` (≥ 3 days since the last practice), `lastFocus`, `focusTrend`, `countAccuracy(count)`, `countTrend`, `countSummary`, `checkinTrend`, `checkinSummary` (medians, verdict against a ±1 tolerance, from 5 sessions), `weeklyMeans(points, value, now, weeks = 6)`, `recentDistress` (2 of the last 3 rated sessions 更紧张 / 很不舒服 → suggest gentler practice). No streaks anywhere (product rule).

### 3.5 Export, import, reminders, programmes, persistence

- `toJSON(records, meta?)`, `toCSV(records, names?)` (BOM, CRLF, RFC 4180), `parseImport(text): { records, errors, invalid }`, `exportFileName('json' | 'csv', now?)`, `downloadFile(name, mime, text)`, `MIME`, `CSV_HEADERS`.
- `buildPlanICS(reminders, { startDate, url?, now?, minutes? })` (weekday and weekend events), `buildReminderICS(event)`, `buildRemindersICS(events)`, `planSentence(plan)`, `REMINDER_FILE_NAME`.
- `programDayKey(week, day)`, `parseProgramDay(key)`, `programDayIndex(day)`, `nextProgramDay(progress, weeks)` — progress moves by completed days, not by the calendar.
- `persistence()`, `requestPersistence()` — ask the browser to keep the data (after the first saved record, not on first load).

### 3.6 React hooks

`usePrefs(selector?)`, `useRecords(repo?) → { records, loading, error }`, `useStats(now?) → RecordStats & { loading }`, `useToday()` (local day key, updates at midnight), `useStorageMode(repo?)`.

---

## 4. Heart rate — `@/hrv`

Web Bluetooth heart-rate straps, beat tracking, HRV metrics, and the resonance / comfortable-pace assessment. All analysis is pure; devices are optional (the pace finder works on comfort ratings alone).

| Export | Purpose |
| --- | --- |
| `isBluetoothAvailable()` · `connectHeartRate(): Promise<HeartRateDevice \| null>` · `HeartRateError` (`code`: `unsupported`, `unavailable`, `denied`, `no-service`, `failed`) | Pick and connect a strap (gesture); `null` if the user cancels the chooser. |
| `HeartRateDevice` | `name`, `connected`, `onReading(fn)`, `onDisconnect(fn)`, `disconnect()`, `reconnect()`. |
| `createSimulatedHeartRate(options?)` · `steadyBreathing(rate)` | A deterministic simulated strap (resonance, RSA, artefacts, no-RR mode) for demos and tests. |
| `parseHeartRateMeasurement(view)` | Decode characteristic 0x2A37. |
| `createBeatTracker(): BeatTracker` | `push(measurement, at)` → new `Beat`s on your clock; `beats()`, `rrSupported()`, `status(now)` → `'waiting' \| 'no-contact' \| 'no-rr' \| 'stale' \| 'unstable' \| 'good'` for the signal hint; `reset()`. |
| `cleanRR`, `cleanBeats`, `artifactMask`, `rmssd`, `sdnn`, `meanHr`, `rmssdOfBeats`, `hrSeries`, `cycleAmplitudes`, `typicalAmplitudes`, `peakToTrough`, `lfPower` | Metrics. |
| `summarizeHrv(beats, pacing?): HrvSummary` | Session summary; `meanHr`, `rmssd` and `amplitude` go into `SessionRecord.hrv` via `RecordExtras.hrv`. `pacing` = `{ pattern }` (engine cycles, warm-up skipped), `{ t0, period }` or `{ boundaries }`. |

### 4.1 Pace-finder helpers

| Export | Purpose |
| --- | --- |
| `PACE_FINDER_ASSESSMENT` | 5 steps (`rates` is the frozen tuple `[6.5, 6, 5.5, 5, 4.5]` — the app's `PACE_FINDER_RATES` is this array), 60 s each, first 10 s not analysed, `ratio: SLOW_RATIO` (`'long'`, the slow practice's default from the catalogue: the pace the person will actually practise). `DEFAULT_ASSESSMENT` is the 2-minute strap protocol (unchanged, `ratio: 'equal'`); `planAssessment({ trialSec: 60, ratio: SLOW_RATIO })` equals `planAssessment(PACE_FINDER_ASSESSMENT)`. **Scoring does not depend on the ratio**: `scoreTrial` cuts cycles at `start + k × period` only (amplitude, LF power and pace offset ignore how a cycle splits into inhale and exhale), so equal and long plans score identical beats identically (tested). |
| `planAssessment(config?): AssessmentPlan` | `trials[]`, each with `rate`, `paced` (params for a plan or record), `pattern` (ready for `SessionPlan.pattern`), `period`, `cycles`, `start`, `end`, `analysisStart`. |
| `trialAt(plan, t)` · `targetVolume(plan, t)` | Where second `t` is (settle / measure, elapsed, remaining) · the paced lung volume (for the simulator). |
| `scoreTrial(beats, trial): TrialScore` | With a strap: amplitude ± SE, LF power and peak, quality (`good / noisy / insufficient`) and issues (`gaps / artifacts / off-pace`). When steps run as separate sessions, time the beats as `trial.start + step time`. |
| `pickByComfort(ratings): number \| null` | Highest mean 轻松 (`ease`, 1–5) / `comfort` score; ties → closest to 5.5, then the faster. This is the pace finder's answer. |
| `pickResonance(scores, ratings?): ResonancePick \| null` | Strap-based choice (`basis: amplitude / lf / comfort`, `confidence: high / low`); reference only in the pace finder. |

---

## 5. How the app layer wires the modules

### 5.1 Services and preferences (`src/app/services.ts`)

- `getAudio()` creates the `AudioEngine` on first use (inside a gesture) and immediately applies `prefs.volume.{master, ambience, music, cues}` with `setVolume`, then follows changes to `prefsStore` bus by bus.
- No voice service: `getVoice()` was removed; the controller gets `NULL_VOICE` and nothing calls `audio.setDuck`.
- `getPlatform()` → `createBrowserPlatform()`; `getRepo()` → `getSessionRepo()`.
- `getController()` → `createSessionController({ audio: forwardingPort, voice: NULL_VOICE, platform }, timeScale === 1 ? {} : { timeScale })`. `setTimeScale(n)` (dev `?speed=n`) must be called before the first `getController()`.

### 5.2 Practice + Prefs → `SessionPlan` (`buildPlan` in `src/app/plan.ts`)

`buildPlan(practiceId, minutes, prefs, screening, overrides?)` is pure:

| Plan field | Where it comes from |
| --- | --- |
| `plannedSec` | `fitMinutes(minutes, adjustedDefaults(id, screening))` × 60 (a duration the screening allows); pace finder: 60 per step. |
| `pattern` | Params: `overrides.params` → `prefs.practice[id]` → `prefs.personalRate` (slow) → the practice default (`'personal'` → `personalRate ?? 5.5`). Slow rates (and pace-finder steps) are clamped to **4.5–7.0** (`SLOW_RATE_MIN`–`SLOW_RATE_MAX`), sigh cycles to the engine limits, box steps to 3–6 s (`overrides.params.phase` → `prefs.practice.box.phaseSec` → 4); `buildPattern(params)`; slow breathing gets `withWarmup(...)` unless `overrides.warmup` → `prefs.practice.slow.warmup` turns it off. Pace-finder steps breathe the slow ratio the person will practise: `prefs.practice.slow.ratio` → the slow default (`'long'`). |
| `timeline` | `buildTimeline(getScript(scriptIdFor(id, minutes)), minutes, { level, prosody, endBufferSec: 5 for 1-minute practices })` — no `charsPerSecond` (engine default 3.6; there is no voice rate any more); `level` = `overrides.guidance` → screening-adjusted default → `prefs.guidance`. |
| `cueStyle` | `prefs.cueStyle` (paced practices only). |
| `endBell` | `false` at bedtime and in the pace finder, otherwise `true` (the ending shape; not the bells switch). |
| `bells` | `prefs.bells` (设置 › 钟声): `false` silences the start and end bells. |
| `captionCue` | `prefs.captionCue`, only when there is a timeline, not at bedtime and not for sound practices. |
| `fadeInSec` | 20 at bedtime (`BEDTIME_FADE_IN_SEC`), otherwise 8. |
| `prosody` | `'settle'` at bedtime, otherwise `'steady'` (same value passed to `buildTimeline`). |
| `sound` | Sound practices: `prefs.sounds[mode]`; others: `prefs.practice[id].ambience / music` → the practice's default, with `prefs.volume.ambience / music`; then `fitMix(mix, mode)`; `mode` is written only for sound and bedtime practices. |
| `intervalSec` | Timer: `prefs.intervalBell` minutes × 60 when shorter than the practice. |
| `leadSec` · `cues` · `haptics` · `silentEnd` · `voice` | `prefs.leadIn` (0–30) · `prefs.cues` (not at bedtime, not for 一分钟停一停) · `prefs.haptics` · `prefs.silentEnd` · always `false` (v1 has no voice guidance). |
| `params` | Paced: `{ rate, ratio }` / `{ cycle }` / `{ inhale, holdIn, exhale, holdOut }`; plus `level` (guided), `interval` (timer), `mode` (sound), `step` (pace finder). |

### 5.3 During a practice

`startPractice()` (click handler) → `buildPlan` → `controller.start(plan)`. Pages read `useSessionState()` and `useSessionClock()` and call the flows: pause / resume / end, `mark()`, `countTap()`, `stepBack()`, `skipSection()`, and sound changes through `changeSessionSound(mix)` (→ `controller.setSound`) plus `rememberSound()` (→ `prefs.setPractice` / `prefs.setVolume`).

### 5.4 After a practice (`src/app/flows/finish.ts`)

1. `controller.onFinish(result)` → if `isRecordable(result)` (≥ 60 s, not a pace-finder step): `resultToRecord(result, { checkin: { pre } })` → `repo.add(record)`.
2. Summary answers are saved as they are tapped: `repo.update(id, { feeling })`, `repo.update(id, { checkin: { post } })` (keeps `pre`), `repo.update(id, { note })` (≤ 200 characters; empty deletes). After a feeling is saved, `recentDistress(await repo.all())` decides whether to suggest a gentler practice.
3. **有点急 → remembered rate**: for `slow` with `rateSteps > 0` and a rate the user chose (not prescribed by a programme), `finalRate` rounded to 0.5 and clamped to **4.5–7.0** (`SLOW_RATE`) goes to `prefs.setPractice('slow', { rate })` and `prefs.set({ personalRate })`. The next slow-breathing plan starts there.
4. Programme days: `prefs.completeProgramDay(programId, day)` when a counted day is completed.
5. `closeSummary()` → `controller.reset()`.

### 5.5 Records and Today

`useRecords()` and `useStats(now)` (→ `computeStats`) feed the Records page: week totals and dots, month calendar (`monthCalendar` for other months), focus marks per 10 minutes, counting accuracy (`countAccuracy`, `countSummary.trend`), check-in medians and points (`checkin`, `checkinPoints`), weekly means. Today uses `welcomeBack`, `weekDots` and `recentDistress`. Export uses `toJSON` / `toCSV` + `exportFileName` + `downloadFile`; import uses `parseImport` + `repo.importMany`.

### 5.6 Pace finder

Each of the five steps is a 60-s session started from the page (APP.md §8.4): `startPractice({ practiceId: 'pace-finder', from: 'pace-finder', overrides: { params: { rate, step }, leadSec: 3 after the first } })`, with `PACE_FINDER_RATES` from `src/app/plan.ts` — which **is** `PACE_FINDER_ASSESSMENT.rates` (one source). Steps are not saved one by one. After each step the page asks 轻松吗 (1–5) and collects `ComfortRating { rate, ease }`; `pickByComfort(ratings)` gives the suggested pace. 「设为慢呼吸的节律」 writes `prefs.setPractice('slow', { rate })` and `prefs.set({ personalRate: rate })`; `savePaceFinderRun(results, { chosenRate, hrv })` stores the run as one record. With a strap: feed readings into `createBeatTracker()`, score each step with `scoreTrial(beats, trial)` (beats timed as `trial.start` + step time) and pass `summarizeHrv(...)` as `hrv`; `pickResonance` is a reference only. The steps breathe the slow ratio the person will practise (`prefs.practice.slow.ratio`, default `long`), and `PACE_FINDER_ASSESSMENT.ratio` is the same default (`SLOW_RATIO`); scoring only uses cycle boundaries, so a person who switched slow breathing to `equal` is scored the same way.

---

## 6. Verified in a real browser

`session-lab.html` + `src/dev/session-lab.ts` (dev server only; not part of the production build) build the controller exactly as above — real `createAudioEngine()`, `NULL_VOICE`, `createBrowserPlatform()` — and run four short sessions: slow breathing 40 s with glide cues and 有点急 at 15 s (in the 7.5/min warm-up cycle, so the pace slows to 7 and holds there: rates 8 → 7.5 → 7, `finalRate` 7); a 30-s guided script with a skippable section and `skipSection()`; focus 20 s with three marks; unlimited sound ended by hand after 15 s. Each result is also converted with `resultToRecord`. `e2e-audio/session.spec.ts` (Chrome, `--autoplay-policy=no-user-gesture-required`) checks that each session completes, `onFinish` fires once with sensible numbers, the audio clock keeps pace with the wall clock, the bed is audible, the limiter worklet loads and is switched in, and the console stays clean.

```bash
npx playwright test -c playwright.audio.config.ts --project=dev e2e-audio/session.spec.ts   # about 2 minutes
npm run dev   # then open http://localhost:5173/session-lab.html and click a run
```

## 7. Known gaps

- **Bed after the pacer stops**: the bed layers cannot switch from following the breath to their free slow movement mid-practice (`freeRun` is ignored once a layer is paced), so after the pacer stops at the closing the bed holds its last brightness. With the default silent ending the bed is already fading or silent by then (closing ≈ last 30 s, fade from the last 60 s), so this is only audible with 结尾静默 off.
- **Bells off + silent ending copy**: with `bells: false` the silent ending still happens but no bell follows it; `PLAYER.silentEnding` (content) mentions 结束钟声. Content/player to adjust the line when `plan.bells === false`.
