import { auxiliary } from '@/content/auxiliary'
/**
 * 组件自带的几个短标签和读屏用的句式。
 * 能从内容文件（src/content）取的都从那里取；标了 TODO(content) 的是内容里还没有的，已在交付报告里
 * 向内容负责人申请，加上之后把这里的值换成对内容的引用即可，组件不用改。
 * 写法遵守 PRODUCT.md §11：中文与数字之间留空格，日期连写，全角标点。
 */
import { CATALOGUE, EVIDENCE, GRADE_NAMES, RECORDS, SUMMARY, TODAY } from '@/content/copy'
import type { Grade } from '@/content/types'
import { WEEKDAYS } from '@/lib/date'

/** 周一在前的星期名：一 二 … 日 */
export const WEEKDAYS_MON_FIRST: readonly string[] = [1, 2, 3, 4, 5, 6, 0].map(i => WEEKDAYS[i] ?? '')

export const UI = {
  /** 面板右上角的关闭按钮（DESIGN.md §8.13） TODO(content) */
  close: auxiliary('close'),
  /** 步进器的两个按钮（§8.8） TODO(content) */
  decrease: auxiliary('decrease'),
  increase: auxiliary('increase'),
  /** 证据卡片和说明的展开、收起（§8.10、§8.19） */
  expand: EVIDENCE.card.expand,
  collapse: EVIDENCE.card.collapse,
  /** 证据等级前的「证据」二字（今日、练习详情、证据卡片的 kicker，§8.5） TODO(content) */
  evidence: auxiliary('evidence'),
} as const

/** 「10 分钟」「约 7 分钟」「8 周」「60 秒」：分成前缀、数字和单位，分别排版（§8.6） */
export function figureParts(text: string): { before: string; figure: string; unit: string } | null {
  const m = /^(.*?)(\d+(?:\.\d+)?)\s*(\D.*)$/.exec(text)
  if (!m) return null
  return { before: (m[1] ?? '').trimEnd(), figure: m[2] ?? '', unit: m[3] ?? '' }
}

/** 时长：「10 分钟」；时长不固定时「约 7 分钟」 */
export const minutesText = (minutes: number, approx = false): string =>
  approx ? CATALOGUE.about(minutes) : TODAY.minutes(minutes)

/** 计划的长度：「8 周」 */
export const weeksText = (weeks: number): string => CATALOGUE.programs.weeks(weeks)

/**
 * 读屏时的等级：「证据等级 B，中等」（§8.5，取自 CATALOGUE.gradeLabel），拆成前半句和等级词——
 * 等级词同时是看得见的那几个字
 */
export function gradeSpoken(grade: Grade): { lead: string; word: string } {
  const full = CATALOGUE.gradeLabel(grade)
  const word = GRADE_NAMES[grade]
  return full.endsWith(word) ? { lead: full.slice(0, -word.length), word } : { lead: `${full} `, word: '' }
}

/** 拨号链接的读屏名称：「心理援助热线 12356，拨打」（§8.17） TODO(content) */
export const dialLabel = (name: string, display: string): string => auxiliary('dial', name, display)

/** 本周的点：「本周，练过 3 天：周一、周三、周四；今天是周四」（§8.9） TODO(content) */
export function weekDotsLabel(practised: readonly string[], today: string | null): string {
  const days = practised.map(d => auxiliary('weekday', d)).join('、')
  const head = auxiliary('weekPractised', practised.length, practised.length > 0 ? `：${days}` : '')
  return today ? auxiliary('weekToday', head, today) : head
}

/** 月历：「10月练习日历：练过 19 天，练过的日子有实心点；今天是22日」（§8.9） TODO(content) */
export function monthCalendarLabel(month: number, practisedDays: number, todayDate: number | null): string {
  const head = auxiliary('monthCalendar', month, practisedDays)
  return todayDate ? auxiliary('calendarToday', head, todayDate) : head
}

/** 点图横轴上的日期：一个月里第一次出现时写「10月5日」，之后只写「12日」 TODO(content) */
export const axisDate = (month: number, day: number, withMonth: boolean): string =>
  withMonth ? auxiliary('monthDay', month, day) : auxiliary('day', day)

/** 「4.5 秒」「30 秒」：节律示意的括号和轴的最后一个标签（§8.9） TODO(content) */
export const secondsText = (seconds: number): string => auxiliary('seconds', seconds)

/** 「15 次」：各练习的次数、数息「数乱了」的次数（§8.9） TODO(content) */
export const timesText = (n: number): string => auxiliary('times', Math.round(n))

/** 阅读页上图的编号「图 1」（§8.9） TODO(content) */
export const figureNumber = (n: number): string => auxiliary('figure', n)

/** 「3 分 12 秒」：读屏用的时刻（回神时间线、段落图） TODO(content) */
export function momentText(sec: number): string {
  const total = Math.max(0, Math.round(sec))
  const m = Math.floor(total / 60)
  const s = total % 60
  return s ? auxiliary('minutesSeconds', m, s) : auxiliary('minutes', m)
}

/** 回神时间线：「回神 6 次，分别在 1 分 36 秒、2 分 31 秒……」（§8.15.8） TODO(content)「，分别在」 */
export function focusTimelineLabel(marks: readonly number[]): string {
  const head = SUMMARY.marks(marks.length)
  return marks.length > 0 ? auxiliary('focusTimeline', head, marks.map(momentText).join('、')) : head
}

/** 段落图：「身体扫描进度：开始从 0 分，呼吸从 1 分 12 秒，……」（§8.15.7） TODO(content)「从」 */
export function stepChartLabel(name: string, sections: readonly { title: string; t0: number }[]): string {
  return `${name}：${sections.map(s => auxiliary('sectionStart', s.title, momentText(s.t0))).join('，')}`
}

/**
 * 练习前后自评点图：「练习前后自评（0–10）：练习前中位数 6，练习后中位数 4，各 19 次」（§8.9）
 * TODO(content) 句式
 */
export function checkinLabel(medians: { before: number; after: number }, count: number): string {
  const { title, before, after, median } = RECORDS.checkin
  return auxiliary(
    'checkinSummary',
    title,
    before,
    median,
    medians.before,
    after,
    median,
    medians.after,
    count,
  )
}

/** 记录表（桌面）的表头和行内操作（§8.18）。有内容键的取内容，其余 TODO(content) */
export const TABLE = {
  date: RECORDS.date,
  /** TODO(content) */
  start: auxiliary('start'),
  practice: RECORDS.practice,
  duration: RECORDS.duration,
  /** 回神次数、数息准确率、节律和轮数这一栏 TODO(content) */
  data: auxiliary('records'),
  /** TODO(content) */
  feeling: auxiliary('feeling'),
  before: RECORDS.checkin.before,
  after: RECORDS.checkin.after,
  note: SUMMARY.note.label,
  /** 操作那一栏的表头只给读屏 TODO(content) */
  actions: auxiliary('actions'),
  /** TODO(content) */
  detail: auxiliary('detail'),
  delete: RECORDS.list.delete,
} as const
