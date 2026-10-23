/**
 * 练习记录：把引擎的结果变成记录，以及校验任何来路的记录（数据库、导入文件、备用存储）。
 * 校验的原则：身份和练习时长（id、练习、类型、开始时间、实际秒数）不对就整条丢弃；
 * 其余字段能修就修、修不了就去掉，不因为一个次要字段损坏而丢掉用户的练习时间。
 */
import type { SessionResult } from '@/engine/types'
import { DAY_MS, dayKey } from '@/lib/date'
import { clamp, round1 } from '@/lib/math'
import { newId } from '@/lib/random'
import {
  cleanText,
  dayKeyToUTC,
  finite,
  intIn,
  isAmbienceId,
  isFeeling,
  isInstant,
  isMusicId,
  isPlainObject,
  isPracticeId,
  isPracticeKind,
  isSoundMode,
  within,
} from './guards'
import { type Feeling, RECORD_VERSION, type SessionRecord } from './types'

/** 不足 1 分钟的练习不记录：多半是误触或试听 */
export const MIN_RECORD_SEC = 60

/** 一次专注最多保留的回神时刻 */
export const MAX_MARKS = 2000

// 一次练习最长按一天算，超出的一定是坏数据
const MAX_SEC = 24 * 3600
const MAX_TALLY = 100_000
const MAX_PARAMS = 24
const MAX_ID = 128
const MAX_NOTE = 500
const MAX_SKIPPED = 64
const MAX_SECTION_ID = 64
const PARAM_KEY = /^[A-Za-z][A-Za-z0-9_-]{0,31}$/
const EARLIEST = Date.UTC(2000, 0, 1)
const LATEST = Date.UTC(2100, 0, 1)

type Count = NonNullable<SessionRecord['count']>
type Checkin = NonNullable<SessionRecord['checkin']>
type Hrv = NonNullable<SessionRecord['hrv']>

/** 练习结束时一并记下的内容；练习后才填的（练后自评、感觉、备注）也可以之后用 repo.update 补上 */
export interface RecordExtras {
  /** 练习前后的紧张程度自评 0–10 */
  checkin?: Checkin
  /** 连接心率带时的摘要 */
  hrv?: Hrv
  feeling?: Feeling
  note?: string
}

/** 练满 MIN_RECORD_SEC 才值得记录 */
export const isRecordable = (result: Pick<SessionResult, 'practicedSec'>): boolean =>
  result.practicedSec >= MIN_RECORD_SEC

/**
 * 引擎结果转为记录。不检查最短时长，是否保存由调用方用 isRecordable 决定。
 * 开始时间或练习时长无效时抛 RangeError（引擎不会产生这种结果）。
 */
export function resultToRecord(result: SessionResult, extras: RecordExtras = {}): SessionRecord {
  const { plan } = result
  const paced = plan.kind === 'paced'
  const record = sanitizeRecord({
    v: RECORD_VERSION,
    id: newId(),
    practiceId: plan.practiceId,
    kind: plan.kind,
    startedAt: result.startedAt,
    // 记下开始时所在时区的日期：以后换了时区，这次练习仍算在当时的那一天
    date: dayKey(new Date(result.startedAt)),
    plannedSec: plan.plannedSec,
    actualSec: result.practicedSec,
    completed: result.completed,
    sound: soundOf(result),
    params: { ...plan.params },
    // 专注即使一次也没回神，也要记下空列表，以区分「0 次」和「不适用」
    marks: plan.kind === 'focus' || result.marks.length > 0 ? result.marks : undefined,
    count: result.count ?? undefined,
    breaths: paced ? breathsOf(result) : undefined,
    rate: paced ? rateOf(result) : undefined,
    rateSteps: paced ? result.rateSteps : undefined,
    skipped: result.skipped.length > 0 ? result.skipped : undefined,
    checkin: extras.checkin,
    hrv: extras.hrv,
    feeling: extras.feeling,
    note: extras.note,
  })
  if (!record) {
    throw new RangeError(`练习结果无法记录：开始时间 ${result.startedAt}，时长 ${result.practicedSec} 秒`)
  }
  return record
}

/**
 * 声音的模式按声音层实际用的记：计划里没写时声音层按放松播放，听声音的记录也就记作放松。
 * 其他练习只在计划写明时才记，免得每条记录都多一项没有信息的「放松」
 */
function soundOf({ plan }: SessionResult): SessionRecord['sound'] {
  const { ambience, music, mode } = plan.sound
  const sound: SessionRecord['sound'] = { ambience, music }
  const recorded = mode ?? (plan.kind === 'sound' ? 'relax' : undefined)
  if (recorded) sound.mode = recorded
  return sound
}

function breathsOf(result: SessionResult): number | undefined {
  if (result.breaths !== null) return result.breaths
  const T = result.plan.pattern?.T
  // 浮点误差会让恰好完成的一轮算少，所以加一点余量
  return T && T > 0 ? Math.floor(result.practicedSec / T + 1e-6) : undefined
}

/** 「有点急」调过速度时记最后稳定的速度：那才是这次练习实际的节奏，计划的速度仍在 params 里 */
function rateOf({ finalRate, plan }: SessionResult): number | undefined {
  if (finalRate !== null && Number.isFinite(finalRate) && finalRate > 0) return finalRate
  const pattern = plan.pattern
  if (!pattern) return undefined
  if (Number.isFinite(pattern.rate) && pattern.rate > 0) return pattern.rate
  return pattern.T > 0 ? 60 / pattern.T : undefined
}

/** 按开始时间先后排序；同一时刻再按 id，保证结果稳定。开始时间已统一为 toISOString 格式，按字符串比较即可 */
export function byStartedAt(a: SessionRecord, b: SessionRecord): number {
  if (a.startedAt !== b.startedAt) return a.startedAt < b.startedAt ? -1 : 1
  if (a.id === b.id) return 0
  return a.id < b.id ? -1 : 1
}

/** 校验并规范化一条记录；无法挽救时返回 null。永不抛错，结果可以再次传入且不变 */
export function sanitizeRecord(raw: unknown): SessionRecord | null {
  try {
    return parseRecord(raw)
  } catch {
    // 带 getter 的怪对象之类的输入也只算无效，不让异常冒到界面
    return null
  }
}

function parseRecord(raw: unknown): SessionRecord | null {
  if (!isPlainObject(raw)) return null
  // 更新版本的记录格式可能变了，宁可拒收也不猜
  if (raw.v !== undefined && raw.v !== RECORD_VERSION) return null
  const { practiceId, kind } = raw
  const id = cleanText(raw.id, MAX_ID)
  const startedAt = parseInstant(raw.startedAt)
  const actual = finite(raw.actualSec)
  if (
    !id ||
    id !== raw.id ||
    !isPracticeId(practiceId) ||
    !isPracticeKind(kind) ||
    !startedAt ||
    actual === null
  )
    return null

  const actualSec = clamp(Math.round(actual), 0, MAX_SEC)
  // 0 表示不限时（引擎的约定）；不限时的练习由用户自己结束，结束即完成
  const plannedSec = intIn(raw.plannedSec, 0, MAX_SEC) ?? actualSec
  const record: SessionRecord = {
    v: RECORD_VERSION,
    id,
    practiceId,
    kind,
    startedAt,
    date: localDate(raw.date, startedAt),
    plannedSec,
    actualSec,
    completed:
      typeof raw.completed === 'boolean' ? raw.completed : plannedSec === 0 || actualSec >= plannedSec,
    sound: parseSound(raw.sound),
    params: parseParams(raw.params),
  }
  const marks = parseMarks(raw.marks, actualSec)
  if (marks) record.marks = marks
  const count = parseCount(raw.count)
  if (count) record.count = count
  const breaths = intIn(raw.breaths, 0, MAX_TALLY)
  if (breaths !== null) record.breaths = breaths
  const rate = finite(raw.rate)
  if (rate !== null && rate > 0) record.rate = round1(clamp(rate, 0.5, 60))
  const rateSteps = intIn(raw.rateSteps, 0, MAX_TALLY)
  if (rateSteps !== null) record.rateSteps = rateSteps
  const skipped = parseSkipped(raw.skipped)
  if (skipped) record.skipped = skipped
  const checkin = parseCheckin(raw.checkin)
  if (checkin) record.checkin = checkin
  if (isFeeling(raw.feeling)) record.feeling = raw.feeling
  const hrv = parseHrv(raw.hrv)
  if (hrv) record.hrv = hrv
  const note = cleanText(raw.note, MAX_NOTE, true)
  if (note) record.note = note
  return record
}

/** 只认带时刻的 ISO 字符串；统一成 toISOString 的格式，按字符串排序才等于按时间排序 */
function parseInstant(x: unknown): string | null {
  if (!isInstant(x)) return null
  const t = Date.parse(x)
  return t >= EARLIEST && t < LATEST ? new Date(t).toISOString() : null
}

/**
 * 记录里的本地日期。本地日期与 UTC 日期最多差一天（时区在 UTC−12 到 UTC+14 之间），
 * 差得更多说明字段坏了，按本机时区从开始时间重算。
 */
function localDate(raw: unknown, startedAt: string): string {
  if (typeof raw === 'string') {
    const local = dayKeyToUTC(raw)
    const utc = dayKeyToUTC(startedAt.slice(0, 10))
    if (local !== null && utc !== null && Math.abs(local - utc) <= DAY_MS) return raw
  }
  return dayKey(new Date(startedAt))
}

function parseSound(x: unknown): SessionRecord['sound'] {
  const o = isPlainObject(x) ? x : {}
  const sound: SessionRecord['sound'] = {
    ambience: isAmbienceId(o.ambience) ? o.ambience : 'none',
    music: isMusicId(o.music) ? o.music : 'none',
  }
  if (isSoundMode(o.mode)) sound.mode = o.mode
  return sound
}

function parseParams(x: unknown): Record<string, number | string> {
  const out: Record<string, number | string> = {}
  if (!isPlainObject(x)) return out
  let n = 0
  for (const [key, raw] of Object.entries(x)) {
    if (n >= MAX_PARAMS) break
    // 键名白名单同时挡住了 __proto__ 之类的原型污染
    if (!PARAM_KEY.test(key)) continue
    const value = finite(raw) ?? cleanText(raw, 64)
    if (value === null) continue
    out[key] = value
    n++
  }
  return out
}

function parseMarks(x: unknown, actualSec: number): number[] | undefined {
  if (!Array.isArray(x)) return undefined
  const out: number[] = []
  for (const item of x) {
    if (out.length >= MAX_MARKS) break
    const t = finite(item)
    if (t !== null) out.push(round1(clamp(t, 0, actualSec)))
  }
  return out.sort((a, b) => a - b)
}

/** 段落 id 来自引导词，本来就是干净的短字符串；需要清理才像样的多半是坏数据，整个丢掉 */
function parseSkipped(x: unknown): string[] | undefined {
  if (!Array.isArray(x)) return undefined
  const out: string[] = []
  for (const item of x) {
    if (out.length >= MAX_SKIPPED) break
    const id = cleanText(item, MAX_SECTION_ID)
    if (id !== null && id === item && !out.includes(id)) out.push(id)
  }
  return out.length ? out : undefined
}

function parseCount(x: unknown): Count | undefined {
  if (!isPlainObject(x)) return undefined
  const cycles = intIn(x.cycles, 0, MAX_TALLY)
  if (cycles === null) return undefined
  // 每一轮的第九口只能是点对、点错、点得太快三者之一，三者之和不会超过轮数
  const correct = Math.min(intIn(x.correct, 0, MAX_TALLY) ?? 0, cycles)
  const errors = Math.min(intIn(x.errors, 0, MAX_TALLY) ?? 0, cycles - correct)
  const resets = intIn(x.resets, 0, MAX_TALLY) ?? 0
  const count: Count = { cycles, correct, errors, resets }
  // 旧记录没有这一项；不补 0，记录读出来才和存进去的一样
  const invalid = intIn(x.invalid, 0, MAX_TALLY)
  if (invalid !== null) count.invalid = Math.min(invalid, cycles - correct - errors)
  return count
}

function parseCheckin(x: unknown): Checkin | undefined {
  if (!isPlainObject(x)) return undefined
  const out: Checkin = {}
  const pre = intIn(x.pre, 0, 10)
  const post = intIn(x.post, 0, 10)
  if (pre !== null) out.pre = pre
  if (post !== null) out.post = post
  return pre === null && post === null ? undefined : out
}

function parseHrv(x: unknown): Hrv | undefined {
  if (!isPlainObject(x)) return undefined
  const out: Hrv = {}
  const meanHr = within(x.meanHr, 25, 240)
  const rmssd = within(x.rmssd, 0, 500)
  const amplitude = within(x.amplitude, 0, 150)
  if (meanHr !== null) out.meanHr = round1(meanHr)
  if (rmssd !== null) out.rmssd = round1(rmssd)
  if (amplitude !== null) out.amplitude = round1(amplitude)
  return Object.keys(out).length ? out : undefined
}
