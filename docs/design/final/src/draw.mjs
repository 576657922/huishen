// 回神 · figures for the mock-ups, drawn from the engine's real parameters.
// Patterns mirror src/engine/patterns.ts: cosine in-out ((1 − cos πq) / 2), sine-out for the
// sigh's top-up, and the slow-breathing warm-up from 8/min down to the target in 0.5 steps,
// two cycles per step. BODY_SCAN_10 is buildTimeline(bodyScanScript, 10, { level: 'standard' }).
// Every function returns an SVG string; colours come from classes styled in components.css.

export const n = (x) => {
  const r = Math.round(x * 100) / 100
  return Object.is(r, -0) ? '0' : String(r)
}
const clamp01 = (q) => Math.min(1, Math.max(0, q))
export const easeInOut = (q) => (1 - Math.cos(Math.PI * clamp01(q))) / 2
export const easeOut = (q) => Math.sin((Math.PI / 2) * clamp01(q))
const EASE = { inout: easeInOut, out: easeOut, flat: () => 0, linear: clamp01 }
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')

/* ------------------------------------------------------------------ patterns */
function withStarts(segs) {
  let t0 = 0
  return segs.map((s) => { const seg = { ...s, t0 }; t0 += s.dur; return seg })
}
export function resonance(rate = 5.5, ratio = 'long') {
  const T = 60 / rate
  const i = T * (ratio === 'long' ? 4.5 / 11 : 0.5)
  return { T, rate, segs: withStarts([
    { key: 'in', label: '吸', dur: i, y0: 0, y1: 1, ease: 'inout' },
    { key: 'out', label: '呼', dur: T - i, y0: 1, y1: 0, ease: 'inout' },
  ]) }
}
export function sigh(cycle = 10.5) {
  const a = (cycle * 2.5) / 10.5
  const b = (cycle * 1) / 10.5
  return { T: cycle, rate: 60 / cycle, segs: withStarts([
    { key: 'in', label: '吸', dur: a, y0: 0, y1: 0.78, ease: 'inout' },
    { key: 'in2', label: '再吸', dur: b, y0: 0.78, y1: 1, ease: 'out' },
    { key: 'out', label: '呼', dur: cycle - a - b, y0: 1, y1: 0, ease: 'inout' },
  ]) }
}
export function box(s = 4) {
  return { T: 4 * s, rate: 60 / (4 * s), segs: withStarts([
    { key: 'in', label: '吸', dur: s, y0: 0, y1: 1, ease: 'inout' },
    { key: 'hold', label: '停', dur: s, y0: 1, y1: 1, ease: 'flat' },
    { key: 'out', label: '呼', dur: s, y0: 1, y1: 0, ease: 'inout' },
    { key: 'rest', label: '停', dur: s, y0: 0, y1: 0, ease: 'flat' },
  ]) }
}
/** Slow breathing warm-up: 8/min → target in 0.5 steps, two cycles per step (engine constants). */
export function withWarmup(p, start = 8) {
  const cycles = []
  for (let r = start; r > p.rate + 1e-9; r -= 0.5) {
    const T = 60 / r
    const k = T / p.T
    const c = { T, rate: r, segs: p.segs.map((s) => ({ ...s, dur: s.dur * k, t0: s.t0 * k })) }
    cycles.push(c, c)
  }
  return { ...p, warmup: cycles }
}
export const warmupSec = (p) => (p.warmup ?? []).reduce((a, c) => a + c.T, 0)

function pointIn(segs, tc) {
  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i]
    const end = seg.t0 + seg.dur
    if (tc < end || i === segs.length - 1) {
      const q = seg.dur > 0 ? clamp01((tc - seg.t0) / seg.dur) : 1
      return { y: seg.y0 + (seg.y1 - seg.y0) * EASE[seg.ease](q), seg, idx: i, rem: Math.max(0, end - tc) }
    }
  }
}
/** Position at practice second t: { y, seg, rem (s left in this phase), round (1-based), rate } */
export function at(p, t) {
  let start = 0
  let round = 1
  for (const c of p.warmup ?? []) {
    if (t < start + c.T) return { ...pointIn(c.segs, t - start), round, rate: c.rate }
    start += c.T
    round++
  }
  const k = Math.floor((t - start) / p.T)
  return { ...pointIn(p.segs, t - start - k * p.T), round: round + k, rate: p.rate }
}
export const path = (pts) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${n(x)} ${n(y)}`).join('')
export function sample(p, t0, t1, x, y, step = 0.05) {
  const pts = []
  for (let t = t0; t <= t1 + 1e-9; t += step) pts.push([x(t), y(at(p, Math.max(0, t)).y)])
  return pts
}
export function fmtClock(sec) {
  const s = Math.max(0, Math.ceil(sec - 1e-9))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

/* ------------------------------------------------------------------ body scan */
// Standard guidance, 10 minutes (buildTimeline, 2026-10-23). The label on each tread is the section
// title itself, or its first word when the title is longer than two characters (stepLabel), so the
// strip and the player's section title always say the same word: 胸口 ↔ 「胸口、后背和肩膀」.
export const stepLabel = (title) => (title.length <= 2 ? title : title.split(/[、和]/)[0].slice(0, 2))
export const BODY_SCAN_10 = {
  duration: 600,
  sections: [
    { id: 'opening', title: '开始', t0: 0, t1: 71.5 },
    { id: 'breath', title: '呼吸', t0: 71.5, t1: 138.4 },
    { id: 'left-leg', title: '左腿', t0: 138.4, t1: 218.2, skippable: true },
    { id: 'right-leg', title: '右腿', t0: 218.2, t1: 271.4, skippable: true },
    { id: 'lower-torso', title: '臀部、腹部和后腰', t0: 271.4, t1: 327.6, skippable: true },
    { id: 'upper-torso', title: '胸口、后背和肩膀', t0: 327.6, t1: 384.8, skippable: true },
    { id: 'arms', title: '双手和手臂', t0: 384.8, t1: 435.7, skippable: true },
    { id: 'head', title: '脖子、脸和头部', t0: 435.7, t1: 503.0, skippable: true },
    // 全身 runs 503.0–563.1; the closing lines and the silent ending fill the last 37 s
    { id: 'whole', title: '全身', t0: 503.0, t1: 600 },
  ].map((s) => ({ ...s, short: stepLabel(s.title) })),
}

/**
 * The body scan as its section structure on a time axis — a staircase from the feet up.
 * x = time; each section is one tread, one step higher than the last; 全身 is simply the top
 * tread (a filled block read as a highlight or a disabled zone). Labels sit on their own tread,
 * so they can never collide (each label is narrower than its tread at ≥ 300 px). With `now`,
 * past treads are ink-2, the current tread ink up to now, future treads thinner in --line,
 * skipped treads dashed, and a cinnabar dot marks the present.
 */
export function stepChart({ width = 350, step = 6, now = null, axis = true, label = '身体扫描 10 分钟的结构', id = '', skipped = [] } = {}) {
  const S = BODY_SCAN_10
  const top = 15 // room for the top label
  const levels = S.sections.length - 1
  const plotBot = top + levels * step
  const axisY = plotBot + 7 // the axis sits below the plot: the first tread must not merge with it
  const height = axisY + (axis ? 21 : 2)
  const x = (t) => (t / S.duration) * width
  const yOf = (i) => plotBot - i * step
  const treads = []
  const labels = []
  S.sections.forEach((sec, i) => {
    const x0 = x(sec.t0)
    const x1 = x(sec.t1)
    const y = yOf(i)
    const state = skipped.includes(sec.id) ? ' is-skipped' : now == null ? '' : sec.t1 <= now ? ' is-past' : sec.t0 <= now ? ' is-now' : ' is-future'
    const riser = i > 0 ? `M${n(x0)} ${n(yOf(i - 1))}V${n(y)}` : `M${n(x0)} ${n(y)}`
    if (state === ' is-now') {
      // the current tread is split at now: solid behind the dot, light ahead of it
      treads.push(`<path class="sc-tread is-now" d="${riser}H${n(x(now))}"/>`)
      treads.push(`<path class="sc-tread is-future" d="M${n(x(now))} ${n(y)}H${n(x1)}"/>`)
    } else treads.push(`<path class="sc-tread${state}" d="${riser}H${n(x1)}"/>`)
    labels.push(`<text class="sc-label${state === ' is-skipped' ? ' is-future' : state}" x="${n(x0 + (i === 0 ? 0 : 3))}" y="${n(y - 5)}">${sec.short}</text>`)
  })
  let nowEl = ''
  if (now != null) {
    const i = S.sections.findIndex((s) => s.t0 <= now && now < s.t1)
    nowEl = `<circle class="sc-now" cx="${n(x(now))}" cy="${n(yOf(i))}" r="4"/>`
  }
  let axisEl = ''
  if (axis) {
    const parts = [`<path class="sc-base" d="M0 ${n(axisY + 0.5)}H${width}"/>`]
    for (let m = 0; m <= 10; m++) {
      const xx = Math.min(width - 0.5, Math.max(0.5, x(m * 60)))
      parts.push(`<path class="sc-tick${m % 5 ? '' : ' major'}" d="M${n(xx)} ${n(axisY + 1)}v${m % 5 ? 3 : 5}"/>`)
    }
    const ty = height - 1
    parts.push(`<text class="sc-axis" x="0" y="${n(ty)}">0</text>`)
    parts.push(`<text class="sc-axis" x="${n(x(300))}" y="${n(ty)}" text-anchor="middle">5</text>`)
    parts.push(`<text class="sc-axis" x="${width}" y="${n(ty)}" text-anchor="end">10 分钟</text>`)
    axisEl = parts.join('')
  }
  const desc = S.sections.map((s) => `${s.title}从 ${fmtMin(s.t0)}`).join('，')
  return `<svg class="stepchart" width="${width}" height="${n(height)}" viewBox="0 0 ${width} ${n(height)}" role="img" aria-label="${esc(label)}：${esc(desc)}"${id ? ` id="${id}"` : ''}>${treads.join('')}${labels.join('')}${nowEl}${axisEl}</svg>`
}
function fmtMin(t) {
  const m = Math.floor(t / 60)
  const s = Math.round(t % 60)
  return s ? `${m} 分 ${s} 秒` : `${m} 分`
}

/* ------------------------------------------------------------------ practice glyphs */
// 48 × 24 specimens: each practice drawn as its own rhythm. Stroke 1.25, round caps and joins.
const G = { w: 48, top: 3.5, bot: 20.5 }
const gy = (level) => G.bot - level * (G.bot - G.top)
const glyphWave = (p, span, offset = 0) => path(sample(p, offset, offset + span, (t) => ((t - offset) / span) * G.w, gy, span / 240))
export const GLYPHS = {
  slow: () => glyphWave(resonance(5.5, 'long'), 24),
  // one whole sigh, not two: the quick rise, the 再吸 shoulder at 78 % and the long exhale tail
  // only read at this width when a single cycle fills the glyph (it was mistaken for 慢呼吸)
  'cyclic-sigh': () => glyphWave(sigh(10.5), 10.5, 0),
  box: () => glyphWave(box(4), 32),
  'pace-finder': () => {
    const rates = [6.5, 6, 5.5, 5, 4.5]
    const total = rates.reduce((a, r) => a + 60 / r, 0)
    let x0 = 0
    let d = ''
    for (const r of rates) {
      const p = resonance(r, 'equal')
      const w = (60 / r / total) * G.w
      d += path(sample(p, 0, p.T, (t) => x0 + (t / p.T) * w, gy, p.T / 60)).replace(/^M/, d ? 'L' : 'M')
      x0 += w
    }
    return d
  },
  focus: () => `M1 20.5H47${[0.1, 0.19, 0.27, 0.43, 0.56, 0.71, 0.88].map((f) => `M${n(2 + f * 44)} 20.5V11.5`).join('')}`,
  'breath-count': () => {
    let d = 'M1 20.5H47'
    for (let i = 0; i < 9; i++) d += `M${n(4 + i * 5)} 20.5V${i === 8 ? 8.5 : 15.5}`
    return d
  },
  'body-scan': () => {
    const s = BODY_SCAN_10.sections
    const lv = (i) => 20.5 - i * (16 / 8)
    let d = ''
    s.forEach((sec, i) => { d += `${i ? 'L' : 'M'}${n((sec.t0 / 600) * 47 + 0.5)} ${n(lv(i))}H${n((sec.t1 / 600) * 47 + 0.5)}` })
    return d
  },
  'breathing-space': () => {
    const top = []
    const bot = []
    for (let i = 0; i <= 94; i++) {
      const xx = 1 + i / 2
      const u = xx < 15 ? easeInOut((xx - 1) / 14) : xx > 33 ? 1 - easeInOut((xx - 33) / 14) : 1
      top.push([xx, 3.5 + u * 7]); bot.push([xx, 20.5 - u * 7])
    }
    return path(top) + path(bot)
  },
  'loving-kindness': () => {
    const half = [1.5, 3.5, 5.75, 8.5]
    const xs = [1, 12, 24, 36, 47]
    let t = ''
    let b = ''
    half.forEach((h, i) => {
      t += `${i ? 'L' : 'M'}${n(xs[i])} ${n(12 - h)}H${n(xs[i + 1])}`
      b += `${i ? 'L' : 'M'}${n(xs[i])} ${n(12 + h)}H${n(xs[i + 1])}`
    })
    return t + b
  },
  'self-compassion': () => 'M1 18.5H15V13H31V7.5H47',
  'open-awareness': () => 'M2 12L46 3.5M2 12L46 20.5M2 12H46M2 12L46 7.75M2 12L46 16.25',
  walking: () => {
    let d = 'M1 12H47'
    for (let i = 0; i < 6; i++) d += `M${n(5.5 + i * 7.4)} 12V${i % 2 ? 18.5 : 5.5}`
    return d
  },
  pause: () => 'M1 16.5H11M16 16.5C19.5 16.5 20.5 7.5 24 7.5S28.5 16.5 32 16.5M37 16.5H47',
  grounding: () => 'M1 18.5H47M8 18.5V12M16 18.5V12M32 18.5V12M40 18.5V12',
  // 听声音 · 放松: a steady water-like line that fades out at the timer's end
  listen: () => {
    const pts = []
    for (let i = 0; i <= 184; i++) {
      const u = i / 184
      const env = u < 0.68 ? 1 : 1 - easeInOut((u - 0.68) / 0.32)
      pts.push([1 + u * 46, 12 - env * (3.1 * Math.sin(2 * Math.PI * u * 3.1) + 1.3 * Math.sin(2 * Math.PI * u * 6.7 + 0.9))])
    }
    return path(pts)
  },
  // 听声音 · 睡前: slower, and the whole length is a fade into silence
  sleep: () => {
    const pts = []
    for (let i = 0; i <= 184; i++) {
      const u = i / 184
      const env = 1 - easeInOut(Math.min(1, u / 0.92))
      pts.push([1 + u * 46, 12 - env * (4.4 * Math.sin(2 * Math.PI * u * 2.2) + 0.9 * Math.sin(2 * Math.PI * u * 5.3 + 0.5))])
    }
    return path(pts)
  },
  // 睡前身体扫描: the staircase walked downward, from the head to the feet
  'body-scan-sleep': () => {
    const k = 7
    let d = ''
    for (let i = 0; i < k; i++) d += `${i ? 'L' : 'M'}${n(1 + (i * 46) / k)} ${n(4.5 + (i * 16) / (k - 1))}H${n(1 + ((i + 1) * 46) / k)}`
    return d
  },
  'breathing-space-coping': () => GLYPHS['breathing-space'](),
}
export function glyph(id) {
  if (id === 'timer') {
    return `<svg class="glyph" width="48" height="24" viewBox="0 0 48 24" aria-hidden="true"><path d="M6.25 16.5H41.75M24 16.5V12.5"/><circle cx="3.75" cy="16.5" r="2.5"/><circle cx="44.25" cy="16.5" r="2.5"/></svg>`
  }
  return `<svg class="glyph" width="48" height="24" viewBox="0 0 48 24" aria-hidden="true"><path d="${GLYPHS[id]()}"/></svg>`
}

/* ------------------------------------------------------------------ breath curve (player) */
/**
 * The scrolling breath curve as one frame of the canvas: the past is a solid 2 px line over a
 * 7 % wash, the future a dashed line in ink-3, and a cinnabar dot sits on the curve at "now".
 * Vertical hairlines every 5 s move with time (they are fixed to the clock, not the screen);
 * elapsed-time labels every 10 s sit under the plot.
 */
export function breathCurve({ p, t, width = 390, height = 232, past = 24, future = 14, padTop = 16, padBot = 40, labels = true }) {
  const t0 = t - past
  const t1 = t + future
  const x = (s) => ((s - t0) / (t1 - t0)) * width
  const y = (lv) => height - padBot - lv * (height - padTop - padBot)
  const plotBot = y(0)
  const grid = []
  for (let s = Math.ceil(t0 / 5) * 5; s <= t1; s += 5) {
    const xx = x(s)
    grid.push(`<path class="bc-grid${s % 10 ? '' : ' major'}" d="M${n(xx)} ${n(padTop - 6)}V${n(plotBot)}"/>`)
    if (labels && s % 10 === 0 && xx > 18 && xx < width - 18) grid.push(`<text class="bc-time" x="${n(xx)}" y="${n(plotBot + 22)}" text-anchor="middle">${fmtClock(s)}</text>`)
  }
  const pastPts = sample(p, Math.max(0, t0), t, x, y, 0.04)
  const futPts = sample(p, t, t1, x, y, 0.04)
  const fill = `${path(pastPts)}L${n(x(t))} ${n(plotBot)}L${n(pastPts[0][0])} ${n(plotBot)}Z`
  const now = at(p, t)
  return `<svg class="breathcurve" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" aria-hidden="true">
<path class="bc-rule" d="M0 ${n(y(1) - 0.5)}H${width}M0 ${n(plotBot + 0.5)}H${width}"/>${grid.join('')}
<path class="bc-fill" d="${fill}"/><path class="bc-past" d="${path(pastPts)}"/><path class="bc-future" d="${path(futPts)}"/>
<path class="bc-nowline" d="M${n(x(t))} ${n(padTop - 6)}V${n(plotBot)}"/><circle class="bc-now" cx="${n(x(t))}" cy="${n(y(now.y))}" r="5"/></svg>`
}

/* ------------------------------------------------------------------ breath specimen (detail) */
/**
 * A practice's own rhythm, drawn at its defaults: `cycles` steady cycles (no warm-up) on a
 * seconds axis — 1 s ticks, a 5 s grid, labels every 10 s with the unit on the last label
 * (「30 秒」). The 2 px line has no area fill: on a reading page a grey wash under the curve
 * reads as a stock area chart (the fill stays in the player, where it marks the past).
 * The first cycle is annotated with brackets naming each phase — 吸 4.5 秒 · 呼 6.5 秒.
 */
export function breathSpecimen({ p, cycles = 3, width = 350, height = 140, label = '' } = {}) {
  const T = p.T * cycles
  const padTop = 30
  const padBot = 24
  const x = (s) => (s / T) * width
  const y = (lv) => height - padBot - lv * (height - padTop - padBot)
  const plotBot = y(0)
  const parts = []
  for (let s = 0; s <= Math.floor(T); s++) {
    const xx = Math.min(width - 0.5, Math.max(0.5, x(s)))
    if (s % 5 === 0) parts.push(`<path class="wf-grid major" d="M${n(xx)} ${n(y(1))}V${n(plotBot)}"/>`)
    parts.push(`<path class="wf-tick${s % 5 ? '' : ' major'}" d="M${n(xx)} ${n(plotBot + 1)}v${s % 5 ? 3 : 5}"/>`)
  }
  const lastLabel = Math.floor(T / 10) * 10
  for (let s = 0; s <= lastLabel; s += 10) {
    const xx = Math.min(width - 0.5, Math.max(0.5, x(s)))
    const txt = s === lastLabel ? `${s} 秒` : `${s}`
    const anchor = s === 0 ? 'start' : x(s) + 20 > width ? 'end' : 'middle'
    // the last label carries the unit; it is centred on its tick unless that would leave the figure
    parts.push(`<text class="wf-axis" x="${n(s === lastLabel && anchor === 'middle' ? xx + 7 : xx)}" y="${n(height - 3)}" text-anchor="${anchor}">${txt}</text>`)
  }
  parts.push(`<path class="wf-rule" d="M0 ${n(plotBot + 0.5)}H${width}"/>`)
  const pts = sample(p, 0, T, x, y, 0.05)
  parts.push(`<path class="wf-line" d="${path(pts)}"/>`)
  const by = 12
  let t0 = 0
  for (const seg of p.segs) {
    const x0 = x(t0) + (t0 ? 2 : 0.5)
    const x1 = x(t0 + seg.dur) - 2
    parts.push(`<path class="wf-bracket" d="M${n(x0)} ${by + 5}V${by}H${n(x1)}V${by + 5}"/>`)
    const secs = String(Math.round(seg.dur * 2) / 2) // the engine describes phases in 0.5 s steps (DESCRIBE_STEP_SEC)
    parts.push(`<text class="wf-note" x="${n((x0 + x1) / 2)}" y="${by - 3}" text-anchor="middle">${seg.label} ${secs} 秒</text>`)
    t0 += seg.dur
  }
  const aria = label || `默认节律，每分钟 ${Math.round(p.rate * 10) / 10} 次：${p.segs.map((s) => `${s.label} ${Math.round(s.dur * 2) / 2} 秒`).join('，')}。`
  return `<svg class="warmup" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(aria)}">${parts.join('')}</svg>`
}

/* ------------------------------------------------------------------ focus timeline */
/**
 * Every 回神 leaves a vertical tick on the session's time axis. In the player the past part of
 * the baseline is solid, the rest dotted, with a cinnabar dot at "now"; in the summary the
 * whole session is past.
 */
export function focusTimeline({ width = 350, minutes = 10, marks = [], t = null, tick = 16, label = '' }) {
  const D = minutes * 60
  const top = 4
  const base = top + tick + 6
  const height = base + 26
  const x = (s) => Math.min(width - 1, Math.max(1, (s / D) * width))
  const parts = []
  const tn = t ?? D
  parts.push(`<path class="ftl-past" d="M0 ${n(base)}H${n(x(tn))}"/>`)
  if (t != null) parts.push(`<path class="ftl-future" d="M${n(x(tn) + 4)} ${n(base)}H${width}"/>`)
  for (const m of marks) parts.push(`<path class="ftl-tick" d="M${n(x(m))} ${n(base - 1)}V${n(base - 1 - tick)}"/>`)
  for (let mm = 0; mm <= minutes; mm++) {
    const xx = Math.min(width - 0.5, Math.max(0.5, (mm * 60 / D) * width))
    const major = mm % 5 === 0
    parts.push(`<path class="ftl-minor${major ? ' major' : ''}" d="M${n(xx)} ${n(base + 4)}v${major ? 5 : 3}"/>`)
    if (major) parts.push(`<text class="ftl-axis" x="${n(xx)}" y="${n(height - 2)}" text-anchor="${mm === 0 ? 'start' : mm === minutes ? 'end' : 'middle'}">${mm === minutes ? `${mm} 分钟` : mm}</text>`)
  }
  if (t != null) parts.push(`<circle class="ftl-now" cx="${n(x(tn))}" cy="${n(base)}" r="4"/>`)
  const times = marks.map((m) => `${Math.floor(m / 60)} 分 ${Math.round(m % 60)} 秒`).join('、')
  const aria = label || `回神 ${marks.length} 次，分别在 ${times}`
  return `<svg class="ftl" width="${width}" height="${n(height)}" viewBox="0 0 ${width} ${n(height)}" role="img" aria-label="${esc(aria)}">${parts.join('')}</svg>`
}

/* ------------------------------------------------------------------ forest plot (evidence) */
/**
 * Effect sizes with 95% CIs on one shared axis: a 2 px range, an 8 px estimate dot with a
 * ground-coloured ring, and a hairline at zero. Rows carry their own labels in HTML; this
 * draws only the marks and the axis.
 */
export function forest(rows, { width = 200, rowH = 32, min = -0.2, max = 1.0, ticks = [0, 0.5, 1] } = {}) {
  const pad = 6
  const x = (v) => pad + ((v - min) / (max - min)) * (width - 2 * pad)
  const height = rows.length * rowH + 20
  const els = [`<path class="ci-zero" d="M${n(x(0))} 0V${rows.length * rowH}"/>`, `<path class="ci-axis" d="M${pad} ${rows.length * rowH + 0.5}H${width - pad}"/>`]
  for (const t of ticks) {
    els.push(`<path class="ci-axis" d="M${n(x(t))} ${rows.length * rowH}v4"/>`)
    els.push(`<text class="ci-lab" x="${n(x(t))}" y="${height - 2}" text-anchor="middle">${t}</text>`)
  }
  rows.forEach((r, i) => {
    const cy = i * rowH + rowH / 2
    els.push(`<path class="ci-range" d="M${n(x(r.lo))} ${n(cy)}H${n(x(r.hi))}"/>`)
    els.push(`<circle class="ci-est" cx="${n(x(r.g))}" cy="${n(cy)}" r="4"/>`)
  })
  return `<svg class="ci" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" aria-hidden="true">${els.join('')}</svg>`
}

/* ------------------------------------------------------------------ programme glyph */
/** A programme as its weeks: one 4.5 px square per week on the 48 × 24 glyph grid (八周 = 8, 四周 = 4). */
export function programGlyph(weeks = 8) {
  const s = 4.5
  const gap = (46 - weeks * s) / Math.max(1, weeks - 1)
  const pitch = Math.min(s + gap, 6.5)
  let d = ''
  for (let i = 0; i < weeks; i++) d += `M${n(1 + i * pitch)} ${n(14.25)}h${s}v${s}h${-s}Z`
  return `<svg class="glyph" width="48" height="24" viewBox="0 0 48 24" aria-hidden="true"><path d="${d}"/></svg>`
}

/* ------------------------------------------------------------------ effect size rows (evidence card) */
/**
 * One outcome's effect as a full-width row: a hairline at zero, a 2 px range for the 95% CI and
 * an 8 px estimate dot with a ground-coloured ring. All rows of a card share min / max, so they
 * align; ciAxis draws the shared scale once under the last row.
 */
export function ciBar({ g, lo, hi }, { width = 350, min = -0.8, max = 0.2, h = 16 } = {}) {
  const pad = 5
  const x = (v) => pad + ((v - min) / (max - min)) * (width - 2 * pad)
  const cy = h / 2
  return `<svg class="ci" width="${width}" height="${h}" viewBox="0 0 ${width} ${h}" aria-hidden="true"><path class="ci-zero" d="M${n(x(0))} 0V${h}"/><path class="ci-range" d="M${n(x(lo))} ${cy}H${n(x(hi))}"/><circle class="ci-est" cx="${n(x(g))}" cy="${cy}" r="4"/></svg>`
}
export function ciAxis({ width = 350, min = -0.8, max = 0.2, ticks = [-0.8, -0.5, -0.2, 0] } = {}) {
  const pad = 5
  const x = (v) => pad + ((v - min) / (max - min)) * (width - 2 * pad)
  const els = [`<path class="ci-axis" d="M${pad} 0.5H${width - pad}"/>`]
  for (const t of ticks) {
    els.push(`<path class="ci-axis" d="M${n(x(t))} 0.5v4"/>`)
    els.push(`<text class="ci-lab" x="${n(x(t))}" y="17" text-anchor="middle">${t === 0 ? '0' : String(t).replace('-', '−')}</text>`)
  }
  return `<svg class="ci" width="${width}" height="20" viewBox="0 0 ${width} 20" aria-hidden="true">${els.join('')}</svg>`
}
