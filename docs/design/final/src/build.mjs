#!/usr/bin/env node
// Build the final mock-ups: expand {{ … }} in src/pages/*.html, write ../<page>.html, render
// ../<page>.png (and ../<page>-full.png for long pages) and print an audit per screenshot.
//   node src/build.mjs                 all pages
//   node src/build.mjs today records   some pages
//   node src/build.mjs --no-shoot      write HTML only
//   node src/build.mjs --check         only the freshness gate (exit 1 when a PNG is stale)
// The icon sprite is inlined from ../icons.svg because Chrome refuses an external <use> on file://.
// Copy comes from src/content via ./content.mjs; strings content does not have yet are NEW[…].
//
// Gate (DESIGN.md §14.4): the build exits 1 when an audit finds a defect it can name (overflow,
// low contrast, collisions, small targets, a short last line, no route to help within two steps)
// or when any PNG is older than tokens.css, components.css, icons.svg, the content files or its HTML.
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as charts from './charts.mjs'
import * as K from './content.mjs'
import * as D from './data.mjs'
import * as draw from './draw.mjs'
import { shootAll } from './shoot.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const FINAL = path.resolve(HERE, '..')

// name: { src = name, size: [width, height, scale], full?, vars? }
export const PAGES = {
  today: { size: [390, 844, 2] },
  'today-dark': { src: 'today', size: [390, 844, 2], vars: { THEME: 'dark' } },
  practices: { size: [390, 844, 2], full: true },
  'detail-slow': { size: [390, 844, 2], full: true },
  'player-breath': { size: [390, 844, 2] },
  'player-breath-landscape': { src: 'player-breath', size: [844, 390, 2], vars: { LANDSCAPE: true } },
  'player-focus': { size: [390, 844, 2] },
  'player-guided': { size: [390, 844, 2] },
  pause: { size: [390, 844, 2] },
  distress: { size: [390, 844, 2] },
  'distress-200': { src: 'distress', size: [390, 844, 2], vars: { TEXT200: true } },
  summary: { size: [390, 844, 2], full: true },
  records: { size: [390, 844, 2], full: true },
  'records-desktop': { size: [1440, 900, 1], full: true },
  evidence: { size: [390, 844, 2], full: true },
  'before-start': { size: [390, 844, 2] },
  states: { size: [1200, 0, 1] },
}

const MARK_PATH = 'M6 6H42V9.4H6ZM6 38.6H42V42H6ZM6 6H11.6V44.4H6ZM36.4 6H42V42H36.4ZM15.7 15H32.3V17.6H15.7ZM15.7 28.8H32.3V31.4H15.7ZM15.7 15H19.5V32.8H15.7ZM28.5 15H32.3V31.4H28.5Z'

const sha = (files) => {
  const h = crypto.createHash('sha256')
  for (const f of files) h.update(fs.readFileSync(f))
  return h.digest('hex').slice(0, 10)
}
const CSS_FILES = ['tokens.css', 'components.css', 'icons.svg'].map((f) => path.join(FINAL, f))
const STAMP = {
  tokens: sha([CSS_FILES[0]]),
  components: sha([CSS_FILES[1]]),
  icons: sha([CSS_FILES[2]]),
  content: sha(K.CONTENT_FILES),
}

let V = {}
const h = {
  head(title, { theme = 'light', bars = 'tabs', surface = '', extra = '' } = {}) {
    const t = V.THEME ?? theme
    const style = V.TEXT200 ? ' style="font-size: 200%"' : ''
    return `<!doctype html>
<html lang="zh-CN" data-theme="${t}" data-bars="${bars}"${surface ? ` data-surface="${surface}"` : ''}${style}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="huishen-build" content="tokens.css ${STAMP.tokens} · components.css ${STAMP.components} · icons.svg ${STAMP.icons} · src/content ${STAMP.content}">
<title>${title}</title>
<link rel="stylesheet" href="tokens.css">
<link rel="stylesheet" href="components.css">
<link rel="stylesheet" href="_mock/mock.css">${extra}
</head>`
  },
  sprite() {
    const svg = fs.readFileSync(path.join(FINAL, 'icons.svg'), 'utf8')
    const defs = svg.slice(svg.indexOf('<defs>'), svg.indexOf('</defs>') + 7).replace(/<!--[\s\S]*?-->/g, '')
    return `<!-- inlined copy of icons.svg (file:// cannot reference an external sprite) -->\n<svg width="0" height="0" style="position:absolute" aria-hidden="true">${defs.replace(/\n\s*/g, '')}</svg>`
  },
  icon(name, cls = 'icon', label = null) {
    return `<svg class="${cls}"${label ? ` role="img" aria-label="${label}"` : ' aria-hidden="true"'}><use href="#i-${name}"/></svg>`
  },
  seal(cls = 'seal') {
    return `<svg class="${cls}" viewBox="6 6 36 38.4" aria-hidden="true"><path fill="currentColor" d="${MARK_PATH}"/></svg>`
  },
  lockup(href = '/') {
    return `<a class="lockup" href="${href}" aria-label="回神 · 今日">${h.seal()}<span class="wordmark" aria-hidden="true">回神</span></a>`
  },
  device(extraClass = '') {
    return `<div class="device${V.LANDSCAPE ? ' device--landscape' : ''}${extraClass ? ` ${extraClass}` : ''}">`
  },
  statusbar(time = '21:12') {
    if (V.LANDSCAPE) return '' // iOS hides the status bar in landscape
    return `<svg class="statusbar" data-chrome width="390" height="47" viewBox="0 0 390 47" aria-hidden="true">
<text x="54" y="32" text-anchor="middle" class="sb-time">${time}</text>
<g fill="currentColor"><rect x="296" y="25" width="3" height="4.5" rx="1"/><rect x="300.5" y="22.5" width="3" height="7" rx="1"/><rect x="305" y="20" width="3" height="9.5" rx="1"/><rect x="309.5" y="17.5" width="3" height="12" rx="1"/></g>
<g fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round"><path d="M318.6 21.2a10.4 10.4 0 0 1 14.8 0"/><path d="M321.4 24.1a6.2 6.2 0 0 1 9.2 0"/></g>
<circle cx="326" cy="27.6" r="1.9" fill="currentColor"/>
<rect x="340.5" y="17.5" width="24.5" height="12" rx="3.8" fill="none" stroke="currentColor" stroke-opacity=".38" stroke-width="1"/>
<rect x="342.5" y="19.5" width="17" height="8" rx="2.2" fill="currentColor"/>
<path d="M366.6 21.6v4.2a2.2 2.2 0 0 0 0-4.2z" fill="currentColor" fill-opacity=".45"/></svg>`
  },
  homebar() {
    return '<div class="homebar" data-chrome aria-hidden="true"></div>'
  },
  tabbar(active = 'today') {
    const tabs = [['today', '今日', '/'], ['practice', '练习', '/practices'], ['records', '记录', '/records'], ['evidence', '依据', '/evidence']]
    return `<nav class="tabbar" aria-label="主导航">${tabs.map(([id, label, href]) => `<a class="tab" href="${href}"${id === active ? ' aria-current="page"' : ''}>${h.icon(id === active ? `${id}-on` : id)}<span>${label}</span></a>`).join('')}</nav>`
  },
  rail(active = 'records') {
    const items = [['today', '今日', '/'], ['practice', '练习', '/practices'], ['records', '记录', '/records'], ['evidence', '依据', '/evidence']]
    return `<nav class="rail" aria-label="主导航">
  ${h.lockup('/')}
  <div class="rail__list">${items.map(([id, label, href]) => `<a class="rail__item" href="${href}"${id === active ? ' aria-current="page"' : ''}>${h.icon(id === active ? `${id}-on` : id)}<span>${label}</span></a>`).join('')}</div>
  <div class="rail__foot">
    <a class="rail__item" href="/help">${h.icon('help')}<span>求助方式</span></a>
    <a class="rail__item" href="/settings">${h.icon('settings')}<span>设置</span></a>
    <p class="rail__note">离线可用。练习记录只保存在这台设备上。</p>
  </div>
</nav>`
  },
  /** the grade mark: boxed letter + word, with the screen-reader sentence (§8.5) */
  grade(g, { prefix = false, word = true } = {}) {
    if (!g) return ''
    return `<span class="grade">${prefix ? '证据 ' : ''}<span class="grade__box" aria-hidden="true">${g}</span>${word ? `<span class="grade__word"><span class="vh">证据等级 ${g}，</span>${D.GRADE_NAMES[g]}</span>` : `<span class="vh">证据等级 ${g}，${D.GRADE_NAMES[g]}</span>`}</span>`
  },
  /** the four mainland numbers in a ruled 2 × 2 (§8.17) */
  dialGrid() {
    const lines = K.SAFETY.CRISIS_RESOURCES[0].lines
    return `<div class="dial">${lines.map((l) => `<a href="${l.href}" aria-label="${l.name} ${l.display}，拨打"><span class="dial__name">${l.name}</span><span class="dial__num">${l.display}${h.icon('phone')}</span></a>`).join('')}</div>`
  },
}

const ctx = { ...h, ...draw, ...charts, D, K, NEW: K.NEW, get V() { return V } }

function expand(src) {
  const names = Object.keys(ctx)
  return src.replace(/\{\{([\s\S]+?)\}\}/g, (_, expr) => {
    const f = new Function(...names, `return (${expr})`)
    return String(f(...names.map((k) => ctx[k])))
  })
}

// DESIGN.md §4.4: a quantity never ends a line apart from its unit, and a statistic never breaks at
// its operator — those spaces become U+00A0 (the app does the same in its text helper). Calendar
// references (2026年10月 · 10月22日) are written without spaces, so 年 月 日 are not units here.
const UNITS = '天周次分秒项人轮条段处页岁个'
function bindUnits(html) {
  return html
    .replace(new RegExp(`(\\d)((?:</span>)?)[ ](?=[${UNITS}])`, 'g'), '$1$2 ')
    .replace(/([A-Za-z²η]) ([=<>≤≥≈]|&lt;|&gt;) (?=[−\-\d.])/g, '$1 $2 ')
}

const outputsOf = (name) => {
  const p = PAGES[name]
  const [, ht] = p.size
  const out = []
  if (ht) out.push(`${name}.png`)
  if (p.full || !ht) out.push(`${name}${ht ? '-full' : ''}.png`)
  return out
}

/** Freshness gate: every PNG must be newer than the system files, the content and its own HTML. */
function freshness() {
  const sys = Math.max(...[...CSS_FILES, ...K.CONTENT_FILES].map((f) => fs.statSync(f).mtimeMs))
  const stale = []
  for (const name of Object.keys(PAGES)) {
    const html = path.join(FINAL, `${name}.html`)
    for (const png of outputsOf(name)) {
      const p = path.join(FINAL, png)
      if (!fs.existsSync(p) || !fs.existsSync(html)) { stale.push(`${png} (missing)`); continue }
      const t = fs.statSync(p).mtimeMs
      if (t < sys || t < fs.statSync(html).mtimeMs) stale.push(png)
    }
  }
  const orphans = fs.readdirSync(FINAL).filter((f) => f.endsWith('.png') && !Object.keys(PAGES).some((n) => outputsOf(n).includes(f)))
  return { stale, orphans }
}

const args = process.argv.slice(2)
const noShoot = args.includes('--no-shoot')
const checkOnly = args.includes('--check')
const only = args.filter((a) => !a.startsWith('--'))
let failed = false

if (!checkOnly) {
  const pages = only.length ? only : Object.keys(PAGES)
  const jobs = []
  for (const page of pages) {
    const cfg = PAGES[page]
    if (!cfg) throw new Error(`unknown page ${page}`)
    V = { ...(cfg.vars ?? {}) }
    const src = fs.readFileSync(path.join(HERE, 'pages', `${cfg.src ?? page}.html`), 'utf8')
    const out = path.join(FINAL, `${page}.html`)
    fs.writeFileSync(out, bindUnits(expand(src)))
    const [w, ht, s] = cfg.size
    if (ht) jobs.push({ html: out, png: path.join(FINAL, `${page}.png`), w, h: ht, s })
    if (cfg.full || !ht) jobs.push({ html: out, png: path.join(FINAL, `${page}${ht ? '-full' : ''}.png`), w, h: 0, s, auto: true })
  }
  if (!noShoot && jobs.length) {
    const results = await shootAll(jobs, { audit: true })
    for (const r of results) {
      const a = r.report
      const full = r.png.endsWith('-full.png')
      console.log(`\n${path.basename(r.png)}  ${r.w}×${r.h}@${r.s}  [tokens ${STAMP.tokens} · components ${STAMP.components} · icons ${STAMP.icons} · content ${STAMP.content}]`)
      console.log(`  sizes ${a.sizes.join(' / ')}  (${a.sizes.length})   fonts ${a.fams.join(', ')}   input ${a.input}`)
      const bad = []
      if (a.overflow) bad.push(`horizontal overflow ${a.overflow}`)
      if (a.low.length) bad.push(`low contrast: ${a.low.join(' | ')}`)
      if (a.collisions.length) bad.push(`text collisions: ${a.collisions.join(' | ')}`)
      if (a.small.length) bad.push(`targets < 44: ${a.small.join(' | ')}`)
      if (a.shortLast.length) bad.push(`short last lines (< 4): ${a.shortLast.join(' | ')}`)
      if (!a.helpRoute) bad.push('no route to help: a page without a tab bar needs a /help link or the 不舒服 control (PRODUCT §10)')
      for (const b of bad) console.log(`  !! ${b}`)
      // the viewport shot and the full shot audit the same page; count each defect once
      if (bad.length && (full || !PAGES[path.basename(r.png, '.png')]?.full)) failed = true
    }
  }
}

const { stale, orphans } = freshness()
if (stale.length) { console.log(`\n!! stale or missing PNGs: ${stale.join(', ')}`); failed = true }
if (orphans.length) console.log(`\n   PNGs that no page produces (delete or add a page): ${orphans.join(', ')}`)
if (!stale.length) console.log('\nall PNGs are newer than tokens.css, components.css, icons.svg, src/content and their HTML')
process.exitCode = failed ? 1 : 0
