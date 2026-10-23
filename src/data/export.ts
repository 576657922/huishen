/**
 * 导出与导入。JSON 是完整备份，可以再导入；CSV 给表格软件看，不能导入。
 * 练习、声音的中文名由调用方传入（来自 content），数据层不依赖内容层的实现。
 */
import type { AmbienceId, MusicId } from '@/audio/types'
import type { PracticeId } from '@/content/types'
import { dayKey } from '@/lib/date'
import { round1 } from '@/lib/math'
import { pad2 } from '@/lib/time'
import { isPlainObject } from './guards'
import { byStartedAt, sanitizeRecord } from './record'
import { countAccuracy } from './stats'
import type { Feeling, SessionRecord } from './types'

export const EXPORT_VERSION = 1

export const MIME = {
  json: 'application/json',
  csv: 'text/csv',
  ics: 'text/calendar',
} as const

export interface RecordsFile {
  app: 'huishen'
  kind: 'records'
  version: typeof EXPORT_VERSION
  /** ISO 时间 */
  exportedAt: string
  appVersion?: string
  records: SessionRecord[]
}

export interface ExportMeta {
  /** 默认为当前时间 */
  exportedAt?: Date
  appVersion?: string
}

/**
 * 完整备份。外层字段逐行排版，每条记录压成一行：仍是标准 JSON，
 * 又不会因为回神时刻的长数组变成一个数字占一行，用文本编辑器打开也看得清。
 */
export function toJSON(records: readonly SessionRecord[], meta: ExportMeta = {}): string {
  const head: Omit<RecordsFile, 'records'> = {
    app: 'huishen',
    kind: 'records',
    version: EXPORT_VERSION,
    exportedAt: (meta.exportedAt ?? new Date()).toISOString(),
  }
  if (meta.appVersion) head.appVersion = meta.appVersion
  const fields = Object.entries(head).map(
    ([key, value]) => `  ${JSON.stringify(key)}: ${JSON.stringify(value)},`,
  )
  const body = records.map(r => `    ${JSON.stringify(r)}`).join(',\n')
  return `{\n${fields.join('\n')}\n  "records": [${body ? `\n${body}\n  ` : ''}]\n}\n`
}

/* ---------- CSV ---------- */

export const CSV_HEADERS = [
  '日期',
  '开始时间',
  '练习',
  '计划分钟',
  '实际分钟',
  '完成',
  '回神次数',
  '数息准确率',
  '无效轮数',
  '呼吸轮数',
  '每分钟次数',
  '练习前紧张度',
  '练习后紧张度',
  '练完感觉',
  '声景',
  '音乐',
  '备注',
] as const

/** id → 中文名：普通对象、Map 或函数都可以，调用方手里是哪种就传哪种 */
export type NameLookup<K extends string> =
  | Partial<Record<K, string>>
  | ReadonlyMap<string, string>
  | ((id: K) => string | undefined)

/** 练习、声景、音乐的中文名，缺少的直接显示 id；练完感觉有默认的中文，也可以换掉 */
export interface CsvLabels {
  practice?: NameLookup<PracticeId>
  ambience?: NameLookup<AmbienceId>
  music?: NameLookup<MusicId>
  feeling?: NameLookup<Feeling>
}

// 与练习后点选的四个选项同名（PRODUCT.md §6）
const FEELING_NAMES: Record<Feeling, string> = {
  calmer: '更平静',
  same: '差不多',
  tenser: '更紧张',
  unwell: '很不舒服',
}

/**
 * 表格：带 BOM（否则 Excel 会把 UTF-8 中文当成乱码），CRLF 换行，按 RFC 4180 加引号。
 * 按时间先后排列，便于在表格里画趋势。不适用的格子留空，不限时练习的计划分钟也留空。
 * names 可以只是练习的中文名表，也可以是 CsvLabels，连声景、音乐的名字一起给
 */
export function toCSV(
  records: readonly SessionRecord[],
  names: NameLookup<PracticeId> | CsvLabels = {},
): string {
  const labels = toLabels(names)
  const rows = [[...CSV_HEADERS], ...[...records].sort(byStartedAt).map(r => csvRow(r, labels))]
  return `\uFEFF${rows.map(row => row.map(csvField).join(',')).join('\r\n')}\r\n`
}

const LABEL_KEYS = ['practice', 'ambience', 'music', 'feeling'] as const

function toLabels(names: NameLookup<PracticeId> | CsvLabels): CsvLabels {
  if (typeof names === 'function' || isMapLike(names)) return { practice: names }
  return isLabels(names) ? names : { practice: names }
}

// 练习 id 里没有 practice、ambience、music、feeling，带这几个键的只能是 CsvLabels
function isLabels(x: Partial<Record<PracticeId, string>> | CsvLabels): x is CsvLabels {
  return LABEL_KEYS.some(key => Object.hasOwn(x, key))
}

function isMapLike(x: object): x is ReadonlyMap<string, string> {
  return 'get' in x && typeof x.get === 'function'
}

/** 查不到或名字为空时为 undefined；只认自有属性，免得 constructor 之类的键查出函数 */
function nameOf<K extends string>(lookup: NameLookup<K> | undefined, id: K): string | undefined {
  if (lookup === undefined) return undefined
  let name: unknown
  if (typeof lookup === 'function') name = lookup(id)
  else if (isMapLike(lookup)) name = lookup.get(id)
  else name = Object.hasOwn(lookup, id) ? lookup[id] : undefined
  return typeof name === 'string' && name !== '' ? name : undefined
}

function csvRow(r: SessionRecord, labels: CsvLabels): string[] {
  const start = new Date(r.startedAt)
  const accuracy = countAccuracy(r.count)
  return [
    r.date,
    `${pad2(start.getHours())}:${pad2(start.getMinutes())}`,
    nameOf(labels.practice, r.practiceId) ?? r.practiceId,
    r.plannedSec > 0 ? String(round1(r.plannedSec / 60)) : '',
    String(round1(r.actualSec / 60)),
    r.completed ? '是' : '否',
    r.marks ? String(r.marks.length) : '',
    accuracy === null ? '' : `${Math.round(accuracy * 100)}%`,
    // 引擎记下点得太快的轮之前的数息记录按 0 计，与统计一致
    r.count ? String(r.count.invalid ?? 0) : '',
    optional(r.breaths),
    optional(r.rate),
    optional(r.checkin?.pre),
    optional(r.checkin?.post),
    r.feeling ? (nameOf(labels.feeling, r.feeling) ?? FEELING_NAMES[r.feeling]) : '',
    soundLabel(r.sound.ambience, labels.ambience),
    soundLabel(r.sound.music, labels.music),
    r.note ?? '',
  ]
}

const optional = (x: number | undefined): string => (x === undefined ? '' : String(x))

function soundLabel<T extends string>(id: T, names: NameLookup<T> | undefined): string {
  // 没有声音时留空，比写一个「none」更像表格
  return nameOf(names, id) ?? (id === 'none' ? '' : id)
}

/** 以 = + - @ 开头的单元格会被表格软件当成公式执行，前面加单引号 */
function csvField(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

/* ---------- 导入 ---------- */

export interface ImportResult {
  records: SessionRecord[]
  /** 可以直接给用户看的说明：文件层面的问题在前，再列出最多 MAX_IMPORT_ISSUES 条无法识别的记录 */
  errors: string[]
  /** 因无法识别而跳过的记录总数；errors 只列出其中一部分 */
  invalid: number
}

const MAX_IMPORT_CHARS = 50_000_000

/** 坏记录太多时只逐条列出前几条，再多用户也看不过来 */
export const MAX_IMPORT_ISSUES = 20

/** 读入备份文件：接受本应用导出的 JSON，或直接是记录数组。每条记录都重新校验 */
export function parseImport(text: string): ImportResult {
  const source = text.replace(/^\uFEFF/, '').trim()
  if (!source) return failure('文件是空的')
  if (source.length > MAX_IMPORT_CHARS) return failure('文件太大，无法导入')
  let data: unknown
  try {
    data = JSON.parse(source)
  } catch {
    return failure(
      source.startsWith(`${CSV_HEADERS[0]},`)
        ? 'CSV 文件只用于查看，导入请选择 JSON 备份文件'
        : '无法读取：文件不是有效的 JSON',
    )
  }
  const errors: string[] = []
  const list = recordsOf(data, errors)
  const records: SessionRecord[] = []
  let invalid = 0
  for (const [index, item] of list.entries()) {
    const record = sanitizeRecord(item)
    if (record) {
      records.push(record)
      continue
    }
    invalid++
    if (invalid <= MAX_IMPORT_ISSUES) errors.push(`第 ${index + 1} 条记录无法识别，已跳过`)
  }
  if (invalid > MAX_IMPORT_ISSUES) errors.push(`另有 ${invalid - MAX_IMPORT_ISSUES} 条记录无法识别，已跳过`)
  return { records, errors, invalid }
}

function recordsOf(data: unknown, errors: string[]): unknown[] {
  if (Array.isArray(data)) return data
  const issue = (message: string): unknown[] => {
    errors.push(message)
    return []
  }
  if (!isPlainObject(data)) return issue('文件里没有练习记录')
  if (data.app !== undefined && data.app !== 'huishen') return issue('这不是回神导出的文件')
  if (data.kind !== undefined && data.kind !== 'records') return issue('这个文件不是练习记录')
  if (!Array.isArray(data.records)) return issue('文件里没有练习记录')
  if (typeof data.version === 'number' && data.version > EXPORT_VERSION)
    errors.push('文件来自更新版本的回神，部分记录可能无法导入')
  return data.records
}

const failure = (message: string): ImportResult => ({ records: [], errors: [message], invalid: 0 })

/* ---------- 下载 ---------- */

/** 「回神记录-2026-10-22.json」 */
export function exportFileName(ext: 'json' | 'csv', now: Date = new Date()): string {
  return `回神记录-${dayKey(now)}.${ext}`
}

// 立即撤销会让 Safari 和旧版 Firefox 的下载落空，所以留足时间再释放
const REVOKE_DELAY_MS = 30_000

/** 把文字存成文件，交给浏览器下载 */
export function downloadFile(name: string, mime: string, text: string): void {
  const type = /charset=/i.test(mime) ? mime : `${mime};charset=utf-8`
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.rel = 'noopener'
  a.hidden = true
  // Firefox 要求链接在文档里才会响应 click
  document.body.append(a)
  try {
    a.click()
  } finally {
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS)
  }
}
