// 回神 · the shipped copy for the mock-ups. Loads src/content/*.ts directly (Node ≥ 23 strips the
// types), so every string a mock-up prints that exists in content is printed verbatim — safety lines
// above all (DESIGN.md §0, §13.4). Strings content does not have yet are the *(new)* requests of
// DESIGN.md §14.3 and live in NEW below, so they are easy to find and replace.
import { registerHooks } from 'node:module'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
const SRC = path.join(ROOT, 'src')

registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith('@/')) specifier = pathToFileURL(path.join(SRC, specifier.slice(2))).href
    try {
      return next(specifier, context)
    } catch (e) {
      if (/^(\.|\/|file:)/.test(specifier) && !/\.(m?js|ts|json)$/.test(specifier)) {
        try { return next(`${specifier}.ts`, context) } catch { return next(`${specifier}/index.ts`, context) }
      }
      throw e
    }
  },
})
const load = (f) => import(pathToFileURL(path.join(SRC, f)).href)

export const COPY = await load('content/copy.ts')
export const SAFETY = await load('content/safety.ts')
export const PRACTICES = await load('content/practices.ts')
export const TODAY_CONTENT = await load('content/today.ts')
export const CONTENT_FILES = ['content/copy.ts', 'content/safety.ts', 'content/practices.ts', 'content/today.ts'].map((f) => path.join(SRC, f))

export const practice = (id) => PRACTICES.PRACTICE_BY_ID[id]

/** The first n sentences of a paragraph (a sentence ends at 。？！). */
export function sentences(text, n) {
  const parts = text.match(/[^。？！]+[。？！]?/g) ?? [text]
  return parts.slice(0, n).join('')
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/**
 * Phrase wrapping (DESIGN.md §4.3): wrap the text after each ，；：。？！ in an inline-block, so a line
 * ends at a pause. `link` turns listed figures into tel: links (the emergency line's 120).
 */
export function clauses(text, { link = [], html = false } = {}) {
  if (html || text.includes('<')) return clausesHtml(text)
  const parts = text.match(/[^，；：。？！]+[，；：。？！]*/g) ?? [text]
  return parts.map((p, i) => {
    let h = esc(p)
    for (const num of link) h = h.replace(num, `<a href="tel:${num}">${num}</a>`)
    if (i === parts.length - 1) h = keep(h)   // a last clause that wraps still ends on four characters
    return `<span class="clause">${h}</span>`
  }).join('')
}

/**
 * Last-line rule (DESIGN.md §4.3): bind the last `n` visible characters (punctuation included) so a
 * paragraph that wraps never ends on fewer than n. Lines otherwise wrap naturally — this is the
 * default for notes, hints, captions, card fields and rows; clauses() is for spoken and safety text.
 * Markup is respected: the bound run never starts inside an element.
 */
export function keep(text, n = 4) {
  const tokens = text.split(/(<[^>]+>)/).filter((t) => t !== '')
  const isOpen = (t) => t.startsWith('<') && !t.startsWith('</') && !t.endsWith('/>') && !/^<(br|img|wbr)\b/i.test(t)
  // forward pass: which text tokens sit inside a note numeral (they do not count as characters)
  const inCite = []
  const stack = []
  for (const t of tokens) {
    if (isOpen(t)) stack.push(/class="cite"/.test(t))
    else if (t.startsWith('</')) stack.pop()
    inCite.push(!t.startsWith('<') && stack.some(Boolean))
  }
  let count = 0
  let depth = 0
  for (let ti = tokens.length - 1; ti >= 0; ti--) {
    const t = tokens[ti]
    if (t.startsWith('<')) {
      if (t.startsWith('</')) depth++
      else if (isOpen(t)) depth--
      if (count >= n && depth === 0) return wrapFrom(tokens, ti, 0)
      continue
    }
    if (inCite[ti] || count >= n) continue
    const chars = [...t]
    let k = chars.length
    while (k > 0 && count < n) { k--; if (!/\s/.test(chars[k])) count++ }
    if (count >= n && depth === 0) return wrapFrom(tokens, ti, chars.slice(0, k).join('').length)
  }
  return text
}
function wrapFrom(tokens, ti, ci) {
  const head = tokens.slice(0, ti).join('') + tokens[ti].slice(0, ci)
  const rest = tokens[ti].slice(ci) + tokens.slice(ti + 1).join('')
  return `${head}<span class="keep">${rest}</span>`
}

/** clauses() for strings that already carry inline markup: splits only outside open tags. */
function clausesHtml(html) {
  let out = ''
  let cur = ''
  let depth = 0
  const clausesOut = []
  const flush = () => { if (cur) { clausesOut.push(cur); cur = '' } }
  for (const t of html.split(/(<[^>]+>)/)) {
    if (!t) continue
    if (t.startsWith('<')) {
      cur += t
      if (t.startsWith('</')) depth--
      else if (!t.endsWith('/>') && !/^<(br|img|wbr)\b/i.test(t)) depth++
      continue
    }
    const re = /[，；：。？！]+/g
    let last = 0
    let m
    while ((m = re.exec(t))) {
      cur += t.slice(last, m.index + m[0].length)
      last = m.index + m[0].length
      if (depth === 0) flush()
    }
    cur += t.slice(last)
  }
  flush()
  if (clausesOut.length) clausesOut[clausesOut.length - 1] = keep(clausesOut[clausesOut.length - 1])
  out = clausesOut.map((c) => `<span class="clause">${c}</span>`).join('')
  return out
}

/**
 * Strings the mock-ups need that content does not have yet. Each is listed in DESIGN.md §14.3; the
 * content owner adds it under the key named here, and the mock-up then reads it from content.
 */
export const NEW = {
  'TODAY.hard.rowHint': '周期性叹息 · 落地练习 · 求助电话',
  'TODAY.todayLine.body-scan': '从左腿开始，一处一处往上，留意身体的感觉。可以躺着练，睡着了也没关系。',
  'TODAY.quick.structure.pause': '停 · 吸 · 观 · 行',
  'TODAY.quick.structure.breathing-space': '觉察 · 集中 · 扩展',
  'TODAY.quick.structure.cyclic-sigh': '鼻吸 · 补吸 · 长呼',
  'PLAYER.focus.markHintTouch': '也可以轻点屏幕的任何地方',
  'PLAYER.focus.markHintKeys': '也可以按',
  'PLAYER.unwellShort': '不舒服',
  'PLAYER.paced.hurried': '已加快到 6.0 次/分',
  'PLAYER.paced.hurryMax': '已到上限：6.5 次/分',
  'PLAYER.paced.hurryHint': '点一下，每分钟加快 0.5 次',
  'PLAYER.guided.sectionLeft': '这一处还剩',
  'PLAYER.pause.elapsed': '已练',
  'PLAYER.pause.left': '还剩',
  'PLAYER.pause.keys': '键盘：空格继续练习，Esc 关闭面板并继续。',
  'PLAYER.unwell.paused': '练习已暂停。',
  'PLAYER.unwell.endPractice': '结束练习',
  'PLAYER.unwell.fullGuidance': '停止指引全文',
  'PRACTICES.folioEnd': '时长为默认值',
  'PRACTICES.programsAside': '按完成的天数推进',
  'PRACTICES.legend': '名称后的字母是证据等级：A 强、B 中等、C 有限、D 不足，只针对练习说明里写到的那个效果。静坐计时和舒适节律探索是工具，不评等级。',
  'PRACTICES.sleepScanNote': '睡前身体扫描在「声音 · 睡前」里。',
  'DETAIL.figureCaption.slow': '默认节律的 3 轮，约 33 秒。曲线升高是吸气，降低是呼气。',
  'DETAIL.durationLabel': '时长（分钟）',
  'DETAIL.slow.rateHint': '成人觉得舒适的慢呼吸，多在每分钟 4.5–6.5 次之间。憋得慌就调快一点，也可以用舒适节律探索来选。',
  'DETAIL.slow.ratioHint': '两种比例在研究里差别不大，选呼吸更舒服的一种。',
  'DETAIL.slow.warmup': '开头 90 秒逐步放慢',
  'DETAIL.slow.warmupHint': '从每分钟 8 次开始，每两轮慢 0.5 次，约 90 秒后到 5.5 次。',
  'SUMMARY.marksCaption': '每一道竖线是一次回神。',
  'RECORDS.folioEnd': '只在这台设备上',
  'RECORDS.howCounted': '怎么算的',
  'RECORDS.streakNote.title': '为什么不显示连续天数',
  'RECORDS.streakNote.body': '偶尔漏掉一天，几乎不影响习惯的养成；「连续」一旦断掉，反而容易让人放弃。所以这里只记练过的日子，不数断了几天。',
  'RECORDS.streakNote.source': 'Lally 等 2010 · European Journal of Social Psychology',
  'RECORDS.prevMonth': '上个月',
  'RECORDS.nextMonth': '下个月',
  'EVIDENCE.methodMore': '展开其余 3 段',
  'EVIDENCE.reviewedShort': '最后核对：2026年10月',
}
