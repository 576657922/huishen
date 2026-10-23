// Render mock-ups to PNG with headless Chrome over the DevTools protocol, and audit them.
//
// Why not `chrome --screenshot --window-size`: headless windows are clamped to ≥ 500 px wide,
// so a 390 px phone page would lay out at 500 px. Emulation.setDeviceMetricsOverride gives
// the exact viewport (390 × 844 @2x, mobile) or a desktop one (1440 × 900 @1x).
//
// usage (module): await shootAll([{ html, png, w, h, s, auto }], { audit: true })
//   h = 0 or auto = true → the viewport grows to the document height (for *-full.png).
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const SCRATCH = '/private/tmp/claude-501/-Users-user-Workspace-projects---/f22b5159-9a91-45f0-86f3-be240492ba74/scratchpad'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Runs in the page. Collects: font sizes in use, low-contrast text, overflow, colliding
// text boxes and undersized interactive targets. Elements inside [data-chrome] (status bar,
// home indicator) and [data-audit-skip] are ignored.
const AUDIT = `(() => {
  const skip = (el) => el.closest('[data-chrome],[data-audit-skip],.vh,[aria-hidden="true"][inert]')
  const parse = (c) => { const m = c.match(/[\\d.]+/g); if (!m) return null; const v = m.map(Number); return { r: v[0], g: v[1], b: v[2], a: v[3] === undefined ? 1 : v[3] } }
  const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
  const L = (c) => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b)
  const over = (fg, bg) => ({ r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 })
  const bgOf = (el) => {
    const stack = []
    for (let e = el; e; e = e.parentElement) {
      const c = parse(getComputedStyle(e).backgroundColor)
      if (c && c.a > 0) { stack.push(c); if (c.a >= 1) break }
    }
    let bg = { r: 255, g: 255, b: 255, a: 1 }
    for (let i = stack.length - 1; i >= 0; i--) bg = over(stack[i], bg)
    return bg
  }
  const sizes = new Map(), fams = new Map(), low = [], boxes = []
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  let n
  while ((n = walk.nextNode())) {
    const t = n.textContent.trim(); if (!t) continue
    const el = n.parentElement; if (!el || skip(el)) continue
    const cs = getComputedStyle(el)
    if (cs.visibility === 'hidden' || cs.display === 'none') continue
    const range = document.createRange(); range.selectNodeContents(n)
    const rects = [...range.getClientRects()].filter((r) => r.width > 0.5 && r.height > 0.5)
    if (!rects.length) continue
    const fs = parseFloat(cs.fontSize)
    sizes.set(fs, (sizes.get(fs) || 0) + 1)
    const fam = cs.fontFamily.split(',')[0].replace(/"/g, '').trim(); fams.set(fam, (fams.get(fam) || 0) + 1)
    const inSvg = !!el.closest('svg')
    let fg = parse(inSvg ? cs.fill : cs.color)
    if (fg) {
      let op = 1; for (let e = el; e; e = e.parentElement) op *= parseFloat(getComputedStyle(e).opacity || '1')
      fg = { ...fg, a: fg.a * op * (inSvg ? parseFloat(cs.fillOpacity || '1') : 1) }
      const bg = bgOf(el)
      const f = over(fg, bg)
      const a = L(f), b = L(bg)
      const cr = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
      const bold = parseInt(cs.fontWeight, 10) >= 600
      const large = fs >= 24 || (fs >= 18.66 && bold)
      if (cr < (large ? 3 : 4.5)) low.push(t.slice(0, 14) + ' ' + cr.toFixed(2) + ' @' + fs)
    }
    // text scrolled or truncated out of its clipping container is not on screen
    let clip = null
    for (let e = el; e && e !== document.body; e = e.parentElement) {
      const o = getComputedStyle(e); if (/(auto|scroll|hidden|clip)/.test(o.overflowY + o.overflowX)) { clip = e.getBoundingClientRect(); break }
    }
    for (const r of rects) {
      if (clip && (r.bottom <= clip.top + 1 || r.top >= clip.bottom - 1 || r.right <= clip.left + 1 || r.left >= clip.right - 1)) continue
      // text behind an opaque fixed bar (tab bar, dock, sheet footer) is not on screen either
      const hit = document.elementFromPoint((r.left + Math.min(r.right, clip ? clip.right : r.right)) / 2, (r.top + r.bottom) / 2)
      if (hit && hit !== el && !el.contains(hit) && !hit.contains(el)) continue
      const x1 = clip ? Math.min(r.right, clip.right) : r.right
      boxes.push({ el, t: t.slice(0, 10), x0: r.left, y0: r.top, x1, y1: r.bottom })
    }
  }
  // collisions: different text elements whose line boxes overlap by more than 3 px each way
  const hits = []
  const glyph = (b) => ({ x0: b.x0, x1: b.x1, y0: b.y0 + (b.y1 - b.y0) * 0.18, y1: b.y1 - (b.y1 - b.y0) * 0.18 })
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const A = boxes[i], B = boxes[j]
    if (A.el === B.el || A.el.contains(B.el) || B.el.contains(A.el)) continue
    if (A.el.closest('[data-allow-overlap]') || B.el.closest('[data-allow-overlap]')) continue
    const a = glyph(A), b = glyph(B)
    const ox = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0), oy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0)
    if (ox > 3 && oy > 3) hits.push(A.t + ' × ' + B.t)
  }
  // interactive targets smaller than 44 × 44 (data-hit marks controls whose hit area is enlarged by a pseudo-element)
  const small = []
  for (const el of document.querySelectorAll('a[href], button, [role="button"], [role="radio"], [role="switch"], [role="tab"], [role="slider"], input, select, textarea')) {
    if (skip(el) || el.closest('[inert]') || el.hasAttribute('data-hit') || el.matches('.chip:not(.chip--unwell), .btn--small, .cite') || (el.tagName === 'A' && getComputedStyle(el).display === 'inline')) continue // chips and small buttons extend their target with ::before; inline links are exempt (WCAG 2.5.8)
    const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') continue
    const r = el.getBoundingClientRect(); if (!r.width) continue
    if (r.width < 43.5 || r.height < 43.5) small.push((el.getAttribute('aria-label') || el.textContent.trim()).slice(0, 12) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height))
  }
  // short last lines (DESIGN.md §4.3): a block of two or more lines ends on at least 4 characters,
  // punctuation included. Characters are grouped into lines by vertical overlap, so raised note
  // numerals stay on their line.
  const shortLast = []
  const blocks = [...document.querySelectorAll('p, li, li > span, dd, dt, h1, h2, h3, figcaption, .prow__desc, .row__hint, .row__label, .es__row, .note__what, .claim__text, .caption, .lead')]
  for (const el of blocks) {
    if (skip(el) || el.closest('svg, table, [data-audit-lastline="off"]') || el.querySelector('br')) continue // explicit line structure is deliberate
    if ([...el.children].some((c) => /^(block|flex|grid|list-item|table)$/.test(getComputedStyle(c).display) && !c.matches('.clause'))) continue
    const cs = getComputedStyle(el); if (cs.whiteSpace === 'nowrap' || cs.display === 'none') continue
    const chars = []
    const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    let tn
    while ((tn = tw.nextNode())) {
      if (tn.parentElement.closest('.vh, .cite, svg')) continue
      const txt = tn.textContent
      for (let i = 0; i < txt.length; i++) {
        if (/\\s/.test(txt[i])) continue
        const rg = document.createRange(); rg.setStart(tn, i); rg.setEnd(tn, i + 1)
        const rr = rg.getBoundingClientRect(); if (!rr.height) continue
        chars.push({ top: rr.top, bottom: rr.bottom })
      }
    }
    if (chars.length < 6) continue
    const lines = []
    for (const c of chars) {
      const last = lines[lines.length - 1]
      if (last && c.top < last.bottom - 2) { last.n++; last.bottom = Math.max(last.bottom, c.bottom) } else lines.push({ n: 1, bottom: c.bottom })
    }
    if (lines.length >= 2 && lines[lines.length - 1].n < 4) shortLast.push(el.textContent.trim().replace(/\\s+/g, ' ').slice(-10) + ' (' + lines[lines.length - 1].n + ')')
  }
  // PRODUCT §10: help is two steps from any page. Without a tab bar (players, docked pages, sheets),
  // the page itself carries a /help link or the 不舒服 control.
  const visible = (e) => { const s = getComputedStyle(e); return s.display !== 'none' && s.visibility !== 'hidden' && e.getClientRects().length > 0 }
  const tabbar = [...document.querySelectorAll('.tabbar')].some(visible)
  const helpRoute = tabbar || [...document.querySelectorAll('a[href^="/help"], [data-unwell]')].some((e) => visible(e) && !e.closest('[inert]'))
  const input = (matchMedia('(hover: hover) and (pointer: fine)').matches ? 'fine pointer' : 'touch')
  const de = document.documentElement
  return JSON.stringify({
    sizes: [...sizes.keys()].sort((a, b) => a - b), fams: [...fams.keys()],
    low: low.slice(0, 12), collisions: hits.slice(0, 12), small: small.slice(0, 12), shortLast: shortLast.slice(0, 16), helpRoute, input,
    overflow: de.scrollWidth > de.clientWidth ? de.scrollWidth + ' > ' + de.clientWidth : null,
    fontsLoaded: [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family + ' ' + f.weight),
  })
})()`

export async function shootAll(jobs, { audit = true } = {}) {
  const port = 9300 + Math.floor(Math.random() * 600)
  const profile = fs.mkdtempSync(path.join(SCRATCH, 'chrome-profile-'))
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', '--force-color-profile=srgb', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--allow-file-access-from-files', 'about:blank'], { stdio: 'ignore' })
  const results = []
  try {
    let wsUrl
    for (let i = 0; i < 150 && !wsUrl; i++) {
      try {
        const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
        wsUrl = list.find((t) => t.type === 'page')?.webSocketDebuggerUrl
      } catch {}
      if (!wsUrl) await sleep(100)
    }
    if (!wsUrl) throw new Error('chrome did not start')
    const ws = new WebSocket(wsUrl)
    await new Promise((r) => ws.addEventListener('open', r, { once: true }))
    let id = 0
    const pending = new Map()
    const listeners = []
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data)
      if (msg.id && pending.has(msg.id)) {
        const { res, rej } = pending.get(msg.id)
        pending.delete(msg.id)
        msg.error ? rej(new Error(JSON.stringify(msg.error))) : res(msg.result)
      } else if (msg.method) for (const l of listeners.slice()) l(msg)
    })
    const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })) })
    const once = (method, timeout = 20000) => new Promise((res) => {
      const t = setTimeout(() => res(null), timeout)
      const l = (m) => { if (m.method === method) { clearTimeout(t); listeners.splice(listeners.indexOf(l), 1); res(m) } }
      listeners.push(l)
    })
    const evalv = async (expression) => (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result.value
    await send('Page.enable')
    await send('Runtime.enable')
    await send('DOM.enable')
    await send('CSS.enable')
    for (const j of jobs) {
      // a phone is a touch screen: no hover, coarse pointer (DESIGN.md §10.2 picks copy by input)
      const mobile = j.w < 700 || (j.w < 900 && j.h > 0 && j.h < 500)
      const h0 = j.h || 900
      await send('Emulation.setDeviceMetricsOverride', { width: j.w, height: h0, deviceScaleFactor: j.s, mobile })
      await send('Emulation.setTouchEmulationEnabled', { enabled: mobile, maxTouchPoints: mobile ? 5 : 1 })
      try {
        await send('Emulation.setEmulatedMedia', { features: [{ name: 'hover', value: mobile ? 'none' : 'hover' }, { name: 'pointer', value: mobile ? 'coarse' : 'fine' }, { name: 'any-hover', value: mobile ? 'none' : 'hover' }, { name: 'any-pointer', value: mobile ? 'coarse' : 'fine' }] })
      } catch {}
      const loaded = once('Page.loadEventFired')
      await send('Page.navigate', { url: pathToFileURL(j.html).href })
      await loaded
      await evalv('document.fonts.ready.then(() => document.fonts.size)')
      // forced states for the keyboard board: data-force="focus-visible hover active"
      const { root } = await send('DOM.getDocument', { depth: -1 })
      const { nodeIds } = await send('DOM.querySelectorAll', { nodeId: root.nodeId, selector: '[data-force]' })
      for (const nodeId of nodeIds) {
        const { attributes } = await send('DOM.getAttributes', { nodeId })
        const v = attributes[attributes.indexOf('data-force') + 1]
        await send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: v.split(/\s+/) })
      }
      await sleep(400)
      let h = h0
      if (!j.h || j.auto) {
        h = await evalv('Math.ceil(Math.max(document.documentElement.scrollHeight, document.body.scrollHeight))')
        await send('Emulation.setDeviceMetricsOverride', { width: j.w, height: h, deviceScaleFactor: j.s, mobile })
        await sleep(300)
      }
      const report = audit ? JSON.parse(await evalv(AUDIT)) : null
      const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
      fs.writeFileSync(j.png, Buffer.from(shot.data, 'base64'))
      results.push({ png: j.png, w: j.w, h, s: j.s, report })
    }
    ws.close()
  } finally {
    chrome.kill('SIGKILL')
    await sleep(300)
    try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }) } catch {}
  }
  return results
}
