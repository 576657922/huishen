// 回神 · data figures (SVG). One series each, so no legend: the section title names it.
// Marks follow DESIGN.md §8.9: 2 px lines, dots ≥ 8 px with a 2 px ground-coloured ring,
// bars ≤ 8 px thick with a rounded data end and a square base, solid hairline grids,
// text in text tokens. Ink carries data; cinnabar marks only today.
import { n } from './draw.mjs'
import { WEEKDAYS, TODAY, dateOf } from './data.mjs'

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')
const hbar = (x0, cy, len, th, r = 3) => {
  const y0 = cy - th / 2
  const rr = Math.min(r, th / 2, len)
  const x1 = x0 + len
  return `M${n(x0)} ${n(y0)}H${n(x1 - rr)}Q${n(x1)} ${n(y0)} ${n(x1)} ${n(y0 + rr)}V${n(y0 + th - rr)}Q${n(x1)} ${n(y0 + th)} ${n(x1 - rr)} ${n(y0 + th)}H${n(x0)}Z`
}

/**
 * 本周 Mon–Sun as seven day slots (PRODUCT §4: 周一到周日七个点). A practised day is one solid
 * ink dot; a day without practice — past or still ahead — stays empty (PRODUCT §7: 留空, never
 * marked). Frequency, not minutes: the dots carry no length. Today is its own marker — the
 * weekday in cinnabar with a 10 px cinnabar rule under it — whether or not it has a dot yet.
 */
export function weekDots(days, { col = 24, dot = 8 } = {}) {
  const width = col * days.length
  const cy = dot / 2 + 1
  const labelY = cy + dot / 2 + 17
  const height = labelY + 6
  const els = []
  days.forEach((d, i) => {
    const cx = i * col + col / 2
    if (d.minutes > 0) els.push(`<circle class="wd-dot" cx="${n(cx)}" cy="${n(cy)}" r="${dot / 2}"/>`)
    const today = d.state === 'today'
    els.push(`<text class="wd-label${today ? ' is-today' : d.state === 'future' ? ' is-future' : ''}" x="${n(cx)}" y="${n(labelY)}" text-anchor="middle">${d.label}</text>`)
    if (today) els.push(`<path class="wd-today" d="M${n(cx - 5)} ${n(labelY + 4.25)}H${n(cx + 5)}"/>`)
  })
  const done = days.filter((d) => d.minutes > 0)
  const t = days.find((d) => d.state === 'today')
  const desc = `练过 ${done.length} 天：${done.map((d) => `周${d.label}`).join('、')}${t ? `；今天是周${t.label}` : ''}`
  return `<svg class="weekdots" width="${width}" height="${n(height)}" viewBox="0 0 ${width} ${n(height)}" role="img" aria-label="本周，${esc(desc)}">${els.join('')}</svg>`
}

/** 月历点阵: a solid dot = practised; no practice = the numeral alone (留空, past or future alike).
 *  Today = the numeral in cinnabar with a 10 px cinnabar rule under it, plus its dot if practised. */
export function monthCalendar({ year = 2026, month = 10, byDay, today = TODAY, cellW = 48, cellH = 44, dot = 10 } = {}) {
  const first = new Date(year, month - 1, 1)
  const offset = (first.getDay() + 6) % 7
  const daysIn = new Date(year, month, 0).getDate()
  const rows = Math.ceil((offset + daysIn) / 7)
  const head = 20
  const width = cellW * 7
  const height = head + rows * cellH
  const els = []
  WEEKDAYS.forEach((w, i) => els.push(`<text class="cal-wd" x="${n(i * cellW + cellW / 2)}" y="12" text-anchor="middle">${w}</text>`))
  els.push(`<path class="cal-rule" d="M0 ${head - 0.5}H${width}"/>`)
  for (let d = 1; d <= daysIn; d++) {
    const k = offset + d - 1
    const cx = (k % 7) * cellW + cellW / 2
    const top = head + Math.floor(k / 7) * cellH
    const date = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const mins = byDay.get(date) ?? 0
    const isToday = date === today
    els.push(`<text class="cal-day${isToday ? ' is-today' : ''}" x="${n(cx)}" y="${n(top + 15)}" text-anchor="middle">${d}</text>`)
    if (isToday) els.push(`<path class="cal-today" d="M${n(cx - 5)} ${n(top + 19.25)}H${n(cx + 5)}"/>`)
    if (mins > 0) els.push(`<circle class="cal-dot" cx="${n(cx)}" cy="${n(top + 31)}" r="${dot / 2}"/>`)
  }
  const practised = [...byDay.entries()].filter(([k, v]) => v > 0 && k.startsWith(`${year}-${String(month).padStart(2, '0')}`)).length
  return `<svg class="cal" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${month} 月练习日历：练过 ${practised} 天，练过的日子有实心点；今天是 ${Number(today.slice(8))} 日">${els.join('')}</svg>`
}

/** 每 10 分钟回神次数: one dot per focus session on a date axis; no trend line, no target. */
export function focusDotPlot(rows, { width = 520, height = 168, from = '2026-10-05', to = '2026-10-22', max = 10 } = {}) {
  const padL = 28
  const padR = 10
  const padT = 10
  const padB = 28
  const day = 86400000
  const d0 = dateOf(from).getTime() - day * 0.6
  const d1 = dateOf(to).getTime() + day * 0.6
  const x = (date) => padL + ((dateOf(date).getTime() - d0) / (d1 - d0)) * (width - padL - padR)
  const y = (v) => height - padB - (v / max) * (height - padT - padB)
  const els = []
  for (const v of [0, 5, 10]) {
    els.push(`<path class="dp-grid${v ? '' : ' base'}" d="M${padL} ${n(y(v) + 0.5)}H${width}"/>`)
    els.push(`<text class="dp-axis" x="${padL - 8}" y="${n(y(v) + 4)}" text-anchor="end">${v}</text>`)
  }
  for (const [date, label] of [['2026-10-05', '10月5日'], ['2026-10-12', '12日'], ['2026-10-19', '19日']]) {
    els.push(`<path class="dp-tick" d="M${n(x(date))} ${n(y(0) + 1)}v4"/>`)
    els.push(`<text class="dp-axis" x="${n(x(date))}" y="${height - 6}" text-anchor="middle">${label}</text>`)
  }
  for (const r of rows) els.push(`<circle class="dp-dot${r.today ? ' is-today' : ''}" cx="${n(x(r.date))}" cy="${n(y(r.per10))}" r="4"/>`)
  const desc = rows.map((r) => `${dateOf(r.date).getDate()}日 ${r.per10.toFixed(1)}`).join('，')
  return `<svg class="dotplot" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="专注呼吸每 10 分钟回神次数：${esc(desc)}">${els.join('')}</svg>`
}

/** 数息练习数据 as a dot table: one row per session, accuracy on a 50–100 % scale. */
export function countRows(rows, { width = 260, rowH = 32, from = 50 } = {}) {
  const padT = 4
  const height = padT + rows.length * rowH + 22
  const x = (v) => ((v * 100 - from) / (100 - from)) * (width - 2) + 1
  const els = []
  for (const v of [50, 75, 100]) {
    const xx = x(v / 100)
    els.push(`<path class="cr-grid" d="M${n(xx)} ${padT}V${n(padT + rows.length * rowH)}"/>`)
    els.push(`<text class="cr-axis" x="${n(xx)}" y="${height - 4}" text-anchor="${v === 50 ? 'start' : v === 100 ? 'end' : 'middle'}">${v}%</text>`)
  }
  rows.forEach((r, i) => {
    const cy = padT + i * rowH + rowH / 2
    els.push(`<path class="cr-track" d="M1 ${n(cy)}H${width - 1}"/>`)
    els.push(`<circle class="cr-dot" cx="${n(x(r.accuracy))}" cy="${n(cy)}" r="4"/>`)
  })
  return `<svg class="countrows" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" aria-hidden="true">${els.join('')}</svg>`
}

/**
 * 练习前后自评: two rows on one 0–10 axis. Equal answers gather in a small cluster (three dots
 * wide, stacking upward) centred on their value; a vertical rule behind each row marks the
 * median. No arrows, no deltas: the medians are printed above the chart, not compared.
 */
export function checkinStrips({ before, after, medBefore, medAfter }, { width = 352, rowH = 52, dot = 6, gap = 1.5, cols = 3 } = {}) {
  const padL = 56
  const padR = 10
  const height = rowH * 2 + 22
  const x = (v) => padL + (v / 10) * (width - padL - padR)
  const pitch = dot + gap
  const els = []
  for (let v = 0; v <= 10; v++) {
    const xx = x(v)
    els.push(`<path class="ck-grid${v % 5 ? '' : ' major'}" d="M${n(xx)} 2V${rowH * 2}"/>`)
    if (v % 5 === 0) els.push(`<text class="ck-axis" x="${n(xx)}" y="${height - 4}" text-anchor="middle">${v}</text>`)
  }
  ;[['练习前', before, medBefore], ['练习后', after, medAfter]].forEach(([label, vals, med], row) => {
    const base = row * rowH + rowH - 10
    els.push(`<text class="ck-label" x="0" y="${base + 1}">${label}</text>`)
    els.push(`<path class="ck-base" d="M${padL} ${base + 5.5}H${width - padR}"/>`)
    const counts = new Map()
    for (const v of vals) counts.set(v, (counts.get(v) ?? 0) + 1)
    const tallest = Math.max(...[...counts.values()].map((c) => Math.ceil(c / cols)))
    els.push(`<path class="ck-med" d="M${n(x(med))} ${n(base + 9)}V${n(base - tallest * pitch - 3)}"/>`)
    for (const [v, c] of counts) {
      for (let k = 0; k < c; k++) {
        const col = k % cols
        const r = Math.floor(k / cols)
        const inRow = Math.min(cols, c - r * cols)
        const cx = x(v) + (col - (inRow - 1) / 2) * pitch
        els.push(`<circle class="ck-dot" cx="${n(cx)}" cy="${n(base - r * pitch)}" r="${dot / 2}"/>`)
      }
    }
  })
  return `<svg class="checkins" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="练习前后自评（0–10）：练习前中位数 ${medBefore}，练习后中位数 ${medAfter}，各 ${before.length} 次">${els.join('')}</svg>`
}

/** 各练习: minutes per practice, one horizontal bar each. */
export function practiceBars(rows, { width = 200, rowH = 32, th = 6 } = {}) {
  const max = Math.max(...rows.map((r) => r.minutes))
  const height = rows.length * rowH
  const els = rows.map((r, i) => `<path class="pb-bar" d="${hbar(0, i * rowH + rowH / 2, Math.max(3, (r.minutes / max) * width), th)}"/>`)
  return `<svg class="pbars" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" aria-hidden="true">${els.join('')}</svg>`
}

/** 数息 trend on phone (≥ 3 sessions): a 2 px line on a fixed 50–100 % scale, 4 px dots, 8 px on the latest. */
export function sparkline(rows, { width = 120, height = 32, from = 0.5, to = 1 } = {}) {
  const pad = 5
  const x = (i) => pad + (i / Math.max(1, rows.length - 1)) * (width - 2 * pad)
  const y = (v) => height - pad - ((v - from) / (to - from)) * (height - 2 * pad)
  const pts = rows.map((r, i) => [x(i), y(r.accuracy)])
  const line = pts.map(([px, py], i) => `${i ? 'L' : 'M'}${n(px)} ${n(py)}`).join('')
  const dots = rows.map((r, i) => `<circle class="sp-dot${r.today ? ' is-today' : ''}" cx="${n(pts[i][0])}" cy="${n(pts[i][1])}" r="${i === rows.length - 1 ? 4 : 2}"/>`).join('')
  const desc = rows.map((r) => `${dateOf(r.date).getMonth() + 1}月${dateOf(r.date).getDate()}日 ${Math.round(r.accuracy * 100)}%`).join('，')
  return `<svg class="spark" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="数息准确率：${esc(desc)}"><path class="sp-line" d="${line}"/>${dots}</svg>`
}
