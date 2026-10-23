/**
 * 排版助手（DESIGN.md §4.3、§4.4）：内容文件保持原样，渲染时才处理。
 * - bindUnits：数字和后面的量词之间、统计量和运算符之间的空格换成不换行空格，「10 分钟」不会拆在两行；
 * - keep：段落最后四个字（含标点）绑在一起，换行时最后一行至少四个字；
 * - clauses：口播、安全和图注文字只在 ，；：。？！ 之后换行，像字幕一样一句一停。
 * 参考实现：docs/design/final/src/build.mjs（bindUnits）与 content.mjs（keep、clauses）。
 */
import { createElement, Fragment, type ReactNode } from 'react'

/** 不换行空格 U+00A0；写成码位，免得编辑器或格式化把它当成普通空格 */
const NBSP = String.fromCharCode(0xa0)
/** 年月日不在内：日期是「10月22日」这样连写的，本来就没有空格可绑 */
const UNITS = '天周次分秒项人轮条段处页岁个'
const UNIT_SPACE = new RegExp(`(\\d) (?=[${UNITS}])`, 'g')
/** 「p = 0.765」「g = −0.35」「ηp² < 0.001」：运算符两边都不断开 */
const STAT_SPACE = /([A-Za-z²η]) ([=<>≤≥≈]) (?=[−\-\d.])/g
const CLAUSE = /[^，；：。？！]+[，；：。？！]*/g
const KEEP_CHARS = 4

export function bindUnits(text: string): string {
  return text.replace(UNIT_SPACE, `$1${NBSP}`).replace(STAT_SPACE, `$1${NBSP}$2${NBSP}`)
}

/** 从末尾数 n 个可见字符（空白不计）的位置；不足 n 个时返回 -1 */
function keepStart(text: string, n: number): number {
  const chars = [...text]
  let count = 0
  let k = chars.length
  while (k > 0 && count < n) {
    k--
    if (!/\s/.test(chars[k] ?? '')) count++
  }
  if (count < n || k === 0) return -1
  return chars.slice(0, k).join('').length
}

/** 最后四个字放进 .keep（white-space: nowrap）；太短的文字原样返回 */
export function keep(text: string, n = KEEP_CHARS): ReactNode {
  const at = keepStart(text, n)
  if (at < 0) return text
  return createElement(
    Fragment,
    null,
    text.slice(0, at),
    createElement('span', { className: 'keep' }, text.slice(at)),
  )
}

/** 内容段落的默认处理：先绑数字和单位，再绑最后四个字 */
export function typeset(text: string): ReactNode {
  return keep(bindUnits(text))
}

export interface ClauseOptions {
  /** 句子里要变成 tel: 链接的号码，如 ['120']（紧急提示那一句） */
  tel?: readonly string[]
}

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&')

const telLink = (num: string, key: number): ReactNode =>
  createElement('a', { key, href: `tel:${num.replace(/\D/g, '')}` }, num)

/**
 * 句子里的号码变成 tel: 链接。最后一句照样绑住结尾：号码后面的字不足四个时，
 * 连号码一起绑（绑住的一段从不从链接中间开始）
 */
function withTel(text: string, numbers: readonly string[], last: boolean): ReactNode {
  const parts = numbers.length ? text.split(new RegExp(`(${numbers.map(escapeRe).join('|')})`)) : [text]
  if (parts.length === 1) return last ? keep(text) : text
  const nodes = parts.map((part, i) => (numbers.includes(part) ? telLink(part, i) : part))
  const tail = parts[parts.length - 1] ?? ''
  if (last && keep(tail) === tail && parts.length >= 3) {
    // 结尾太短：把最后一个号码和它后面的字放进同一个 .keep
    const head = nodes.slice(0, -2)
    const bound = createElement('span', { key: 'keep', className: 'keep' }, nodes[nodes.length - 2], tail)
    return createElement(Fragment, null, ...head, bound)
  }
  if (last) nodes[nodes.length - 1] = createElement(Fragment, { key: 'tail' }, keep(tail))
  return createElement(Fragment, null, ...nodes)
}

/** 按标点分句，每句一个 .clause（inline-block），最后一句再用 keep 绑住结尾 */
export function clauses(text: string, options: ClauseOptions = {}): ReactNode {
  const tel = options.tel ?? []
  const parts = bindUnits(text).match(CLAUSE) ?? [text]
  return createElement(
    Fragment,
    null,
    ...parts.map((part, i) =>
      createElement('span', { key: i, className: 'clause' }, withTel(part, tel, i === parts.length - 1)),
    ),
  )
}
