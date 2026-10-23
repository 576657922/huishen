/**
 * 练习提醒的日历文件（RFC 5545）。导入系统日历后由日历负责提醒，网页不需要在后台运行。
 * 设置页用 buildPlanICS：按执行意图式的计划，工作日、周末各生成一个事件，放在同一个文件里。
 */
import { addDays } from '@/lib/date'
import { clamp } from '@/lib/math'
import { pad2 } from '@/lib/time'
import { isClockTime } from './guards'
import type { Reminders } from './types'

export const REMINDER_FILE_NAME = '回神练习提醒.ics'

/** RFC 5545 的星期代码 */
export type Weekday = 'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA' | 'SU'

/** 周一在前，与 RRULE 的默认 WKST 一致 */
export const EVERY_DAY: readonly Weekday[] = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU']
export const WORKDAYS: readonly Weekday[] = ['MO', 'TU', 'WE', 'TH', 'FR']
export const WEEKEND: readonly Weekday[] = ['SA', 'SU']

const PRODID = '-//Huishen//Practice Reminder//ZH'
const CRLF = '\r\n'
/** 每行最多 75 个八位组（不含换行），按 UTF-8 字节计，不是按字符 */
const MAX_OCTETS = 75
const DEFAULT_MINUTES = 10
// SEQUENCE 从这一刻起按分钟递增：同一个 UID 再次导入时，日历据此认出这是更新而不是旧版本
const SEQUENCE_EPOCH = Date.UTC(2026, 0, 1)

export interface ReminderEvent {
  /** 提醒的本地时刻，24 小时制「HH:MM」 */
  time: string
  title: string
  description: string
  /** 点日历事件可以直接打开应用 */
  url?: string
  /** 从这一天开始（只取本地日期）；不在 days 里时顺延到第一个提醒日 */
  startDate: Date
  /** 哪几天提醒，默认每天。工作日和周末想要不同的时刻时，各建一个事件，放进同一个文件 */
  days?: readonly Weekday[]
  /**
   * 再次导入同一个 UID 时，日历会更新原来的事件，而不是再添一个。
   * 默认按提醒的日子取固定值（每天、工作日、周末各一个），所以改了时刻重新导入，会替换掉旧的提醒
   */
  uid?: string
  /** DTSTAMP 用的时间，默认现在 */
  now?: Date
  /** 在日历里占用的分钟数，默认 10 */
  minutes?: number
}

/* ---------- 执行意图式的计划 ---------- */

/** 计划句子里固定的那种情况：「如果【太累】，就只做【1 分钟】」（PRODUCT.md §8） */
export const PLAN_OBSTACLE = '太累'

/**
 * 计划的句子，日历提醒的说明用它，界面也可以直接显示：
 * 「在刷牙后，我会做 3 分钟呼吸；如果太累，就只做 1 分钟。」情境或保底留空时略去那半句
 */
export function planSentence(plan: Pick<Reminders, 'cue' | 'action' | 'fallback'>): string {
  const cue = filledIn(plan.cue, CUE_WORDS)
  const action = planAction(plan)
  const fallback = filledIn(plan.fallback, FALLBACK_WORDS)
  const main = cue ? `${spaced('在', cue)}，${spaced('我会做', action)}` : spaced('我会做', action)
  return fallback ? `${main}；如果${PLAN_OBSTACLE}，${spaced('就只做', fallback)}。` : `${main}。`
}

// 句子里已有的词。空格前面印着这些字，用户还是常常再写一遍（「在刷牙后」），去掉开头重复的那个；
// 只去掉句子随后会补回来的词，所以不会改变意思
const CUE_WORDS = ['在']
const ACTION_WORDS = ['我会做', '会做', '做']
const FALLBACK_WORDS = ['就只做', '只做', '就做', '做']
// 每一段后面的标点由句子自己加
const TRAILING_MARKS = /[\s，,。.；;、！!？?…]+$/u

/** 用户填的一段：去掉首尾空白、末尾的标点，以及开头与句子重复的词 */
function filledIn(text: string, words: readonly string[]): string {
  const trimmed = text.trim().replace(TRAILING_MARKS, '')
  const word = words.find(w => trimmed.startsWith(w))
  return word ? trimmed.slice(word.length).trim() : trimmed
}

/** 「我会做」后面的那一段，没填时为「练习」 */
function planAction(plan: Pick<Reminders, 'action'>): string {
  return filledIn(plan.action, ACTION_WORDS) || '练习'
}

const HAN = /\p{Script=Han}/u
const ASCII_WORD = /[A-Za-z0-9]/

/** 中文与数字、拉丁字母之间留空格（PRODUCT.md §11）：句子里的字和用户填的内容相接处补上 */
function spaced(head: string, tail: string): string {
  const a = head.at(-1) ?? ''
  const b = tail.at(0) ?? ''
  const gap = (HAN.test(a) && ASCII_WORD.test(b)) || (ASCII_WORD.test(a) && HAN.test(b))
  return gap ? `${head} ${tail}` : head + tail
}

export interface PlanICSOptions {
  /** 从这一天开始（只取本地日期） */
  startDate: Date
  /** 点日历事件可以直接打开应用 */
  url?: string
  /** DTSTAMP 用的时间，默认现在 */
  now?: Date
  /** 在日历里占用的分钟数；默认取「我会做」里写的分钟数，没写时 10 分钟 */
  minutes?: number
}

/**
 * 计划的提醒：工作日（周一到周五）和周末（周六、周日）各一个事件，放进同一个文件，说明里是计划的句子。
 * 只生成设了时刻的那一组；UID 按组固定，改了时刻重新导入会替换原来的提醒。两组都没设时抛 RangeError
 */
export function buildPlanICS(reminders: Reminders, options: PlanICSOptions): string {
  const common = {
    title: `回神 · ${planAction(reminders)}`,
    description: planSentence(reminders),
    url: options.url,
    startDate: options.startDate,
    // 两个事件用同一个时刻，SEQUENCE 才一致
    now: options.now ?? new Date(),
    minutes: options.minutes ?? minutesIn(reminders.action),
  }
  const events: ReminderEvent[] = []
  if (reminders.weekday !== null) events.push({ ...common, time: reminders.weekday, days: WORKDAYS })
  if (reminders.weekend !== null) events.push({ ...common, time: reminders.weekend, days: WEEKEND })
  if (events.length === 0) throw new RangeError('工作日和周末都没有设提醒时间')
  return buildRemindersICS(events)
}

/** 「3 分钟呼吸」里的 3 */
function minutesIn(action: string): number | undefined {
  const m = /(\d+(?:\.\d+)?)\s*分钟/.exec(action)
  const n = m ? Number(m[1]) : Number.NaN
  return n > 0 ? n : undefined
}

/* ---------- 单个与多个提醒 ---------- */

export function buildReminderICS(event: ReminderEvent): string {
  return buildRemindersICS([event])
}

/** 多个提醒放进同一个文件，一次导入，如工作日 07:30、周末 09:00 */
export function buildRemindersICS(events: readonly ReminderEvent[]): string {
  if (events.length === 0) throw new RangeError('至少要有一个提醒')
  const vevents = events.map(vevent)
  const uids = new Set(vevents.map(e => e.uid))
  if (uids.size !== vevents.length) throw new RangeError('同一个文件里的提醒不能共用一个 UID')
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${PRODID}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...vevents.flatMap(e => e.lines),
    'END:VCALENDAR',
  ]
  return lines.map(foldLine).join(CRLF) + CRLF
}

function vevent(event: ReminderEvent): { uid: string; lines: string[] } {
  if (!isClockTime(event.time)) throw new RangeError(`提醒时间应为 HH:MM：${event.time}`)
  if (Number.isNaN(event.startDate.getTime())) throw new RangeError('提醒的开始日期无效')
  const now = event.now ?? new Date()
  if (Number.isNaN(now.getTime())) throw new RangeError('生成时间无效')
  const days = normalizeDays(event.days)
  const uid = event.uid ?? defaultUid(days)
  const url = httpURL(event.url)
  const lines = [
    'BEGIN:VEVENT',
    `UID:${escapeText(uid)}`,
    `DTSTAMP:${utcStamp(now)}`,
    `SEQUENCE:${Math.max(0, Math.floor((now.getTime() - SEQUENCE_EPOCH) / 60_000))}`,
    // 不带 TZID 的「浮动时间」：练习跟着用户当地的钟点走，出差换了时区也还是早上 7 点
    `DTSTART:${localDate(firstDay(event.startDate, days))}T${event.time.replace(':', '')}00`,
    `DURATION:PT${durationMinutes(event.minutes)}M`,
    `RRULE:${days.length === EVERY_DAY.length ? 'FREQ=DAILY' : `FREQ=WEEKLY;BYDAY=${days.join(',')}`}`,
    `SUMMARY:${escapeText(event.title)}`,
    `DESCRIPTION:${escapeText(event.description)}`,
    ...(url ? [`URL:${url}`] : []),
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'TRIGGER:PT0M',
    `DESCRIPTION:${escapeText(event.title)}`,
    'END:VALARM',
    'END:VEVENT',
  ]
  return { uid, lines }
}

function durationMinutes(raw: number | undefined): number {
  return raw !== undefined && Number.isFinite(raw) ? clamp(Math.round(raw), 1, 24 * 60) : DEFAULT_MINUTES
}

/** 去重并按周一到周日排好；空的或有不认识的代码时抛错，免得生成一个永远不响的提醒 */
function normalizeDays(days: readonly Weekday[] | undefined): Weekday[] {
  if (days === undefined) return [...EVERY_DAY]
  const wanted = new Set<string>(days)
  const out = EVERY_DAY.filter(d => wanted.has(d))
  if (out.length === 0 || out.length !== wanted.size)
    throw new RangeError(`提醒的日子无效：${days.join(',')}`)
  return out
}

/** RFC 5545 要求 DTSTART 本身就是规则里的一天，否则各家日历对第一次提醒的处理不一致 */
function firstDay(start: Date, days: readonly Weekday[]): Date {
  for (let i = 0; i < 7; i++) {
    const d = addDays(start, i)
    if (days.includes(EVERY_DAY[(d.getDay() + 6) % 7] ?? 'MO')) return d
  }
  return start
}

const sameDays = (a: readonly Weekday[], b: readonly Weekday[]): boolean => a.join() === b.join()

function defaultUid(days: readonly Weekday[]): string {
  let name = days.join('-').toLowerCase()
  if (sameDays(days, EVERY_DAY)) name = 'daily'
  else if (sameDays(days, WORKDAYS)) name = 'workdays'
  else if (sameDays(days, WEEKEND)) name = 'weekend'
  return `reminder-${name}@huishen`
}

/** TEXT 值的转义：反斜杠、分号、逗号、换行。全角的「，；」不受影响 */
export function escapeText(text: string): string {
  let out = ''
  for (const ch of text.replace(/\r\n?/g, '\n')) {
    if (ch === '\\' || ch === ';' || ch === ',') out += `\\${ch}`
    else if (ch === '\n') out += '\\n'
    // 其他控制字符在 TEXT 里不合法（制表符除外），直接去掉
    else if (ch !== '\t' && isControl(ch)) continue
    else out += ch
  }
  return out
}

/**
 * 超过 75 个八位组的行折成多行：换行后以一个空格开头，空格也计入下一行的长度。
 * 逐个码位累加字节数，所以不会把一个汉字或表情的 UTF-8 字节拆到两行。
 */
export function foldLine(line: string): string {
  let out = ''
  let octets = 0
  for (const ch of line) {
    const size = utf8Size(ch)
    if (octets + size > MAX_OCTETS) {
      out += `${CRLF} `
      octets = 1
    }
    out += ch
    octets += size
  }
  return out
}

function utf8Size(ch: string): number {
  const code = ch.codePointAt(0) ?? 0
  if (code < 0x80) return 1
  if (code < 0x800) return 2
  // 落单的代理项会被编码成 U+FFFD，也是 3 个字节
  if (code < 0x10000) return 3
  return 4
}

function isControl(ch: string): boolean {
  const code = ch.codePointAt(0) ?? 0
  return code < 0x20 || code === 0x7f
}

/** 只接受 http(s) 链接；URL 是 URI 类型，不做 TEXT 转义，经 URL 解析后也不会带换行 */
function httpURL(raw: string | undefined): string | null {
  if (!raw) return null
  try {
    const url = new URL(raw)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null
  } catch {
    return null
  }
}

const year = (y: number): string => String(y).padStart(4, '0')

function localDate(d: Date): string {
  return `${year(d.getFullYear())}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`
}

function utcStamp(d: Date): string {
  const date = `${year(d.getUTCFullYear())}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}`
  return `${date}T${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}${pad2(d.getUTCSeconds())}Z`
}
