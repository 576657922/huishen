/**
 * 运行时校验。数据库、导入文件、localStorage、其他标签页传来的数据都不可信，进入应用前先过这里。
 */
import type { AmbienceId, MusicId, SoundMode } from '@/audio/types'
import type { GuidanceLevel, PracticeId, PracticeKind, ProgramId } from '@/content/types'
import type { CueStyle } from '@/engine/types'
import { clamp } from '@/lib/math'
import type { Feeling, ThemePref } from './types'

// 用 Record 而不是数组列举：联合类型增减成员时这里会编译报错，不会漏改。
// 漏掉一个 id，这个练习的记录就会在校验时被当成坏数据丢掉
const PRACTICE_IDS: Record<PracticeId, true> = {
  focus: true,
  'breath-count': true,
  'body-scan': true,
  'body-scan-sleep': true,
  'loving-kindness': true,
  'self-compassion': true,
  'breathing-space': true,
  'breathing-space-coping': true,
  'open-awareness': true,
  walking: true,
  pause: true,
  grounding: true,
  timer: true,
  slow: true,
  'cyclic-sigh': true,
  box: true,
  'pace-finder': true,
  listen: true,
  sleep: true,
  resonance: true,
  'extended-exhale': true,
  'rf-assessment': true,
  soundscape: true,
}

const PRACTICE_KINDS: Record<PracticeKind, true> = {
  focus: true,
  count: true,
  guided: true,
  timer: true,
  paced: true,
  sound: true,
  assessment: true,
}

const AMBIENCE_IDS: Record<AmbienceId, true> = {
  none: true,
  rain: true,
  stream: true,
  ocean: true,
  forest: true,
  birds: true,
  wind: true,
  pink: true,
  brown: true,
}

const MUSIC_IDS: Record<MusicId, true> = { none: true, drone: true, pentatonic: true, phasing: true }

const FEELINGS: Record<Feeling, true> = { calmer: true, same: true, tenser: true, unwell: true }

const THEMES: Record<ThemePref, true> = { system: true, light: true, dark: true }

const GUIDANCE_LEVELS: Record<GuidanceLevel, true> = { quiet: true, standard: true, detailed: true }

const CUE_STYLES: Record<CueStyle, true> = { glide: true, ping: true, bed: true, off: true }

const SOUND_MODES: Record<SoundMode, true> = { relax: true, sleep: true }

const PROGRAM_IDS: Record<ProgramId, true> = { 'mindfulness-8w': true, 'breathing-4w': true }

const memberOf =
  <T extends string>(table: Record<T, true>) =>
  (x: unknown): x is T =>
    typeof x === 'string' && Object.hasOwn(table, x)

export const isPracticeId = memberOf(PRACTICE_IDS)
export const isPracticeKind = memberOf(PRACTICE_KINDS)
export const isAmbienceId = memberOf(AMBIENCE_IDS)
export const isMusicId = memberOf(MUSIC_IDS)
export const isFeeling = memberOf(FEELINGS)
export const isTheme = memberOf(THEMES)
export const isGuidanceLevel = memberOf(GUIDANCE_LEVELS)
export const isCueStyle = memberOf(CUE_STYLES)
export const isSoundMode = memberOf(SOUND_MODES)
export const isProgramId = memberOf(PROGRAM_IDS)

/** 普通对象：JSON 解析或结构化克隆的结果。数组、日期等类实例不算 */
export function isPlainObject(x: unknown): x is Record<string, unknown> {
  if (typeof x !== 'object' || x === null || Array.isArray(x)) return false
  const proto: unknown = Object.getPrototypeOf(x)
  return proto === Object.prototype || proto === null
}

export const finite = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) ? x : null)

/** 取整并限制在 [lo, hi]；不是有限数时为 null。用于计数、秒数这类可以截断的量 */
export function intIn(x: unknown, lo: number, hi: number): number | null {
  const n = finite(x)
  return n === null ? null : clamp(Math.round(n), lo, hi)
}

/** 限制在 [lo, hi] 并保留两位小数，避免浮点尾数写进存储 */
export function realIn(x: unknown, lo: number, hi: number): number | null {
  const n = finite(x)
  return n === null ? null : clamp(Math.round(n * 100) / 100, lo, hi)
}

/** 落在 [lo, hi] 内才有效。用于测量值：超出范围说明测错了，截断会造出一个看似合理的假数 */
export function within(x: unknown, lo: number, hi: number): number | null {
  const n = finite(x)
  return n !== null && n >= lo && n <= hi ? n : null
}

export const bool = (x: unknown, fallback: boolean): boolean => (typeof x === 'boolean' ? x : fallback)

const DAY_KEY = /^(\d{4})-(\d{2})-(\d{2})$/

/** YYYY-MM-DD，且是日历上存在的日期 */
export function isDayKey(x: unknown): x is string {
  return typeof x === 'string' && dayKeyToUTC(x) !== null
}

/** 日期键对应的 UTC 零点毫秒数，用来算两个日期键相差几天，结果与本机时区无关 */
export function dayKeyToUTC(key: string): number | null {
  const m = DAY_KEY.exec(key)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2]) - 1
  const d = Number(m[3])
  const t = new Date(0)
  t.setUTCFullYear(y, mo, d)
  t.setUTCHours(0, 0, 0, 0)
  return t.getUTCFullYear() === y && t.getUTCMonth() === mo && t.getUTCDate() === d ? t.getTime() : null
}

/** 24 小时制的「HH:MM」 */
export function isClockTime(x: unknown): x is string {
  return typeof x === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(x)
}

const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/

/** 带时刻的 ISO 时间，如 toISOString 的结果。Date.parse 还认得 '1'、'Oct 1' 之类的写法，坏数据也能解析出一个日期，不能算 */
export function isInstant(x: unknown): x is string {
  return typeof x === 'string' && x.length <= 40 && ISO_INSTANT.test(x) && Number.isFinite(Date.parse(x))
}

const isControl = (code: number): boolean => code < 0x20 || (code >= 0x7f && code < 0xa0)

/**
 * 清理外来文字：去掉控制字符和落单的代理项，制表符变空格，按字符截断（不会把一个汉字或表情拆成两半）。
 * multiline 时保留换行。结果为空时返回 null。
 */
export function cleanText(x: unknown, max: number, multiline = false): string | null {
  if (typeof x !== 'string') return null
  let out = ''
  let n = 0
  for (const ch of x.replace(/\r\n?/g, '\n').trim()) {
    if (n >= max) break
    const code = ch.codePointAt(0) ?? 0
    if (code >= 0xd800 && code <= 0xdfff) continue
    if (ch === '\t') out += ' '
    else if (ch === '\n' && multiline) out += ch
    else if (isControl(code)) continue
    else out += ch
    n++
  }
  return out.trim() || null
}
