// 回神 · the one dataset behind every mock-up, so the numbers agree from screen to screen.
//
// Today is 2026-10-22 (星期四, 霜降前一日). The person started 八周正念 on 10-05 and has
// completed 15 programme days (weeks 1–2 of 专注呼吸 and week 3 day 1 of 身体扫描), so the
// evening recommendation is 「八周正念 · 第 3 周第 2 天 · 身体扫描 10 分钟」.
//
// Note on the brief: it asked for 「本周 5 天 · 64 分钟」 with Mon–Sun dots. On a Thursday a
// Mon–Sun week has only four days so far, so PRODUCT.md §4 (周一到周日七个点) and those numbers
// cannot both hold. The binding spec wins: 本周 = Mon 10-19 → Thu 10-22 = 3 天 · 46 分钟
// (Tuesday was not practised, which also shows the neutral "no practice" state).
//
// Timelines (captions, body-scan sections) come from src/engine/timeline.ts run on the real
// scripts (standard guidance level) — see BODY_SCAN_10 in draw.mjs.
//
// One morning, told across four screens (continuity checked in review, 2026-10-23):
//   player-focus  08:11  today's 10-minute 专注呼吸 (started 08:05:00), 6 回神 so far, 03:08 left
//   distress      08:12  the person felt unwell and opened 不舒服？ — the practice paused at 03:06
//   summary       08:15  they chose 继续, finished (pause ≈ 30 s), 7 回神, and now pick 更紧张: with
//                        「很不舒服」 after 慢呼吸 yesterday, 2 of the last 3 feelings are tense or
//                        unwell, so the summary shows the gentler suggestion (PRODUCT §6)
//   records       later  the table shows that session and the negative ones, styled like any other

export const TODAY = '2026-10-22'
export const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日']

export const NAMES = {
  focus: '专注呼吸',
  'breath-count': '数息',
  'body-scan': '身体扫描',
  'breathing-space': '三分钟呼吸空间',
  'loving-kindness': '慈心',
  'self-compassion': '自我关怀',
  'open-awareness': '开放觉察',
  walking: '正念行走',
  pause: '一分钟停一停',
  timer: '静坐计时',
  slow: '慢呼吸',
  'cyclic-sigh': '周期性叹息',
  box: '箱式呼吸',
  'pace-finder': '舒适节律探索',
}

// feeling: calmer 更平静 · same 差不多 · tenser 更紧张 · unwell 很不舒服
// before / after: 0–10 「此刻有多紧张？」 (enabled from 10-09; null = skipped)
// marks: seconds of each 回神 tap (focus). count: 数息 rounds. paced: rate + rounds.
const S = (date, start, practice, minutes, extra = {}) => ({ date, start, practice, minutes, ...extra })

export const SESSIONS = [
  S('2026-10-01', '12:35', 'slow', 5, { paced: { rate: 5.5, rounds: 29 }, feeling: 'calmer' }),
  S('2026-10-02', '18:10', 'breathing-space', 3, { feeling: 'same' }),
  S('2026-10-04', '21:40', 'body-scan', 10, { feeling: 'calmer' }),
  S('2026-10-05', '07:45', 'focus', 10, { program: 'W1D1', marks: 9, feeling: 'same' }),
  S('2026-10-06', '07:50', 'focus', 10, { program: 'W1D2', marks: 8, feeling: 'calmer' }),
  S('2026-10-07', '12:50', 'cyclic-sigh', 5, { paced: { rate: 5.7, rounds: 27 }, feeling: 'calmer' }),
  S('2026-10-07', '22:05', 'focus', 10, { program: 'W1D3', marks: 6, feeling: 'calmer' }),
  S('2026-10-09', '23:10', 'focus', 5, { program: 'W1D4', marks: 3, feeling: 'same', before: 6, after: 5, note: '很困，只做了 5 分钟。' }),
  S('2026-10-10', '09:30', 'focus', 10, { program: 'W1D5', marks: 7, feeling: 'calmer', before: 7, after: 5 }),
  S('2026-10-10', '16:20', 'breath-count', 10, { count: { correct: 8, errors: 1, resets: 2, invalid: 0 }, feeling: 'same', before: 5, after: 5 }),
  S('2026-10-11', '21:15', 'focus', 10, { program: 'W1D6', marks: 6, feeling: 'calmer', before: 6, after: 4 }),
  S('2026-10-12', '07:40', 'focus', 10, { program: 'W1D7', marks: 7, feeling: 'calmer', before: 7, after: 5 }),
  S('2026-10-12', '14:20', 'pause', 1, { feeling: 'same' }),
  S('2026-10-13', '07:55', 'focus', 10, { program: 'W2D1', marks: 5, feeling: 'calmer', before: 6, after: 4 }),
  S('2026-10-14', '18:30', 'breathing-space', 3, { feeling: 'calmer', before: 7, after: 6 }),
  S('2026-10-14', '22:20', 'focus', 10, { program: 'W2D2', marks: 8, feeling: 'tenser', before: 5, after: 6, note: '一直在想明天的汇报。' }),
  S('2026-10-15', '07:50', 'focus', 10, { program: 'W2D3', marks: 6, feeling: 'calmer', before: 6, after: 4 }),
  S('2026-10-15', '20:40', 'breath-count', 15, { count: { correct: 13, errors: 1, resets: 2, invalid: 0 }, feeling: 'calmer', before: 5, after: 3 }),
  S('2026-10-16', '07:45', 'focus', 10, { program: 'W2D4', marks: 6, feeling: 'same', before: 6, after: 5 }),
  S('2026-10-16', '12:40', 'slow', 5, { paced: { rate: 5.5, rounds: 29 }, feeling: 'calmer', before: 7, after: 4 }),
  S('2026-10-17', '09:10', 'focus', 10, { program: 'W2D5', marks: 4, feeling: 'calmer', before: 4, after: 3 }),
  S('2026-10-18', '16:00', 'breath-count', 10, { count: { correct: 10, errors: 1, resets: 1, invalid: 1 }, feeling: 'same', before: 5, after: 4 }),
  S('2026-10-18', '21:30', 'focus', 10, { program: 'W2D6', marks: 5, feeling: 'same', before: 6, after: 5 }),
  S('2026-10-19', '07:52', 'focus', 15, { program: 'W2D7', marks: 11, feeling: 'calmer', before: 6, after: 4, note: '第一次练 15 分钟，后半段有点困。' }),
  S('2026-10-19', '14:10', 'pause', 1, { feeling: 'same' }),
  S('2026-10-21', '12:40', 'slow', 5, { paced: { rate: 5.5, rounds: 29 }, feeling: 'unwell', before: 6, after: null, note: '节拍太慢，憋得慌，有点头晕。' }),
  S('2026-10-21', '21:35', 'body-scan', 10, { program: 'W3D1', feeling: 'same', before: 5, after: 4, note: '躺着练，到手臂那段睡着了。' }),
  S('2026-10-22', '08:05', 'focus', 10, { marks: 7, feeling: 'tenser', before: 6, after: 6 }), // summary.png: 08:15, 更紧张 just chosen
  S('2026-10-22', '12:40', 'cyclic-sigh', 5, { paced: { rate: 5.7, rounds: 28 }, feeling: 'calmer', before: 6, after: 4 }),
]

// Today's 10-minute focus session, started 08:05:00: seconds of each 回神 tap.
export const FOCUS_TODAY = { minutes: 10, marks: [96, 151, 188, 262, 319, 401, 478] }
// player-focus.png: the same session at 412 s (08:11:52) → 6 taps so far, 剩余 03:08 (rounded up).
export const FOCUS_PLAYER = { minutes: 10, t: 412, marks: FOCUS_TODAY.marks.filter((m) => m <= 412) }
// distress.png: paused 2 s later, at 414 s → 剩余 03:06.
export const FOCUS_PAUSED_AT = 414

/* ---------- derived numbers ---------- */

const pad = (n) => String(n).padStart(2, '0')
export const dateOf = (s) => new Date(`${s}T12:00:00`)
export function weekday(dateStr) {
  return WEEKDAYS[(dateOf(dateStr).getDay() + 6) % 7]
}
export function fmtDay(dateStr) {
  const d = dateOf(dateStr)
  return `${d.getMonth() + 1}月${d.getDate()}日`
}
export const minutesOn = (date) => SESSIONS.filter((s) => s.date === date).reduce((a, s) => a + s.minutes, 0)

/** Mon 10-19 → Sun 10-25 */
export function week() {
  const days = []
  for (let i = 0; i < 7; i++) {
    const date = `2026-10-${pad(19 + i)}`
    const minutes = minutesOn(date)
    const state = date === TODAY ? 'today' : date > TODAY ? 'future' : 'past'
    days.push({ date, label: WEEKDAYS[i], minutes, state })
  }
  const practised = days.filter((d) => d.minutes > 0)
  return { days, practisedDays: practised.length, minutes: practised.reduce((a, d) => a + d.minutes, 0) }
}

export function month() {
  const byDay = new Map()
  for (const s of SESSIONS) byDay.set(s.date, (byDay.get(s.date) ?? 0) + s.minutes)
  const minutes = [...byDay.values()].reduce((a, b) => a + b, 0)
  return { byDay, days: byDay.size, minutes, sessions: SESSIONS.length }
}

export function byPractice() {
  const m = new Map()
  for (const s of SESSIONS) {
    const r = m.get(s.practice) ?? { id: s.practice, name: NAMES[s.practice], sessions: 0, minutes: 0 }
    r.sessions++
    r.minutes += s.minutes
    m.set(s.practice, r)
  }
  return [...m.values()].sort((a, b) => b.minutes - a.minutes || b.sessions - a.sessions)
}

/** 回神 per 10 minutes for every focus session */
export function focusRates() {
  return SESSIONS.filter((s) => s.practice === 'focus').map((s) => ({ date: s.date, start: s.start, minutes: s.minutes, marks: s.marks, per10: (s.marks / s.minutes) * 10, today: s.date === TODAY }))
}

/** PRODUCT §7: accuracy = 1 − (wrong 9th + resets) ÷ (all 9th + resets) */
export function countStats() {
  return SESSIONS.filter((s) => s.practice === 'breath-count').map((s) => {
    const { correct, errors, resets, invalid } = s.count
    const ninths = correct + errors
    return { date: s.date, minutes: s.minutes, correct, errors, resets, invalid, accuracy: 1 - (errors + resets) / (ninths + resets) }
  })
}

export function checkins() {
  const pairs = SESSIONS.filter((s) => s.before != null && s.after != null)
  const med = (xs) => {
    const a = [...xs].sort((p, q) => p - q)
    const k = Math.floor(a.length / 2)
    return a.length % 2 ? a[k] : (a[k - 1] + a[k]) / 2
  }
  return { n: pairs.length, before: pairs.map((s) => s.before), after: pairs.map((s) => s.after), medBefore: med(pairs.map((s) => s.before)), medAfter: med(pairs.map((s) => s.after)) }
}

export const FEELING = { calmer: '更平静', same: '差不多', tenser: '更紧张', unwell: '很不舒服' }

/** What the session list shows in its 「记录」 column */
export function sessionData(s) {
  if (s.marks != null) return `回神 ${s.marks} 次`
  if (s.count) {
    const c = countStats().find((x) => x.date === s.date)
    return `准确率 ${Math.round(c.accuracy * 100)}% · 数乱了 ${s.count.resets} 次`
  }
  if (s.paced) return `${s.paced.rounds} 轮 · ${s.paced.rate.toFixed(1)} 次/分` // rates always carry one decimal (§4.5)
  return ''
}

/* ---------- catalogue (src/content/practices.ts · catalogueSections(), 2026-10-23) ---------- */
// short = Practice.short; min = defaultMinutes; grade = Practice.grade (null for tools).
const P = (id, name, short, min, grade) => ({ id, name, short, min, grade })
export const CATALOGUE = [
  { category: 'meditation', title: '冥想', groups: [{ ids: [
    P('focus', '专注呼吸', '留意呼吸，走神了就回来', 10, 'B'),
    P('breath-count', '数息', '默数呼吸，数到 9 再从 1 开始', 10, 'C'),
    P('body-scan', '身体扫描', '从左脚开始，一处处往上感受', 10, 'C'),
    P('breathing-space', '三分钟呼吸空间', '觉察此刻，集中到呼吸，再扩展到全身', 3, 'C'),
    P('loving-kindness', '慈心', '默念祝愿，从亲近的人到所有生命', 10, 'B'),
    P('self-compassion', '自我关怀', '难受的时候，对自己说三句话', 5, 'B'),
    P('open-awareness', '开放觉察', '从呼吸开始，觉察范围一步步放宽', 10, 'C'),
    P('walking', '正念行走', '慢慢走，留意脚底的感觉', 5, 'D'),
    P('pause', '一分钟停一停', '停下来，吸一口气，看看此刻', 1, 'D'),
    P('timer', '静坐计时', '没有引导，只有钟声和计时', 5, null),
  ] }] },
  { category: 'breathing', title: '呼吸', groups: [{ ids: [
    P('slow', '慢呼吸', '跟着节拍放慢呼吸，轻柔不深', 5, 'B'),
    P('cyclic-sigh', '周期性叹息', '鼻吸，再补一小口，用嘴慢慢呼', 5, 'C'),
    P('box', '箱式呼吸', '吸、停、呼、停，各 4 秒', 5, 'C'),
    P('pace-finder', '舒适节律探索', '试 5 档节奏，选你觉得轻松的', 7, null),
  ] }] },
  { category: 'sound', title: '声音', groups: [
    { title: '放松', ids: [P('listen', '听声音 · 放松', '听一段水声或音乐，定时淡出', 20, 'C')] },
    { title: '睡前', ids: [
      P('sleep', '听声音 · 睡前', '睡前听雨声，定时慢慢淡出', 45, 'D'),
      P('body-scan-sleep', '睡前身体扫描', '躺着，从头顶一处处往下感受', 20, 'C'),
    ] },
  ] },
]
export const GRADE_NAMES = { A: '强', B: '中等', C: '有限', D: '不足' }

/* ---------- 慢呼吸 · 依据: one graded result per line (DESIGN.md §13.4, requested of content in §14.3) ----------
   The two results of practices.ts evidenceSummary, split at its 「；」 and kept verbatim. Each line carries
   its own grade and the notes it cites; until content ships evidenceClaims, this is the model. */
export const SLOW_CLAIMS = [
  { claim: '慢呼吸时心率变异性增大（练习时增幅中等，练完后增幅较小）。', grade: 'B', cites: [2] },
  { claim: '一项 400 人的安慰剂对照试验里，每分钟 5.5 次在压力、焦虑、抑郁和幸福感上，都不比每分钟 12 次的轻柔呼吸更好。', grade: 'B', cites: [3] },
]
