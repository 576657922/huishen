import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PracticeId } from '@/content/types'
import {
  CSV_HEADERS,
  downloadFile,
  EXPORT_VERSION,
  exportFileName,
  MAX_IMPORT_ISSUES,
  MIME,
  parseImport,
  toCSV,
  toJSON,
} from './export'
import { makeRecord } from './fixtures'
import { sanitizeRecord } from './record'

/** 最小的 RFC 4180 读取器，用来核对写出的 CSV 能被正确读回 */
function readCSV(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text.charAt(i)
    if (quoted) {
      if (ch === '"' && text.charAt(i + 1) === '"') {
        field += '"'
        i++
      } else if (ch === '"') quoted = false
      else field += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\r' && text.charAt(i + 1) === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      i++
    } else field += ch
  }
  return rows
}

const zeroCount = { cycles: 0, correct: 0, errors: 0, resets: 0 }

afterEach(() => {
  vi.useRealTimers()
})

describe('toJSON', () => {
  const records = [makeRecord({ marks: [1, 2, 3] }), makeRecord({ note: '换行\n也能存' })]

  it('wraps records in a versioned envelope', () => {
    const exportedAt = new Date(Date.UTC(2026, 9, 22, 13, 0))
    const data = JSON.parse(toJSON(records, { exportedAt, appVersion: '1.0.0' }))
    expect(data).toEqual({
      app: 'huishen',
      kind: 'records',
      version: EXPORT_VERSION,
      exportedAt: '2026-10-22T13:00:00.000Z',
      appVersion: '1.0.0',
      records,
    })
  })

  it('puts one record per line so the file stays readable', () => {
    const lines = toJSON(records).split('\n')
    expect(lines.filter(l => l.startsWith('    {"v":1,'))).toHaveLength(2)
    expect(lines.at(-1)).toBe('')
    expect(JSON.parse(toJSON(records)).appVersion).toBeUndefined()
  })

  it('writes an empty list cleanly', () => {
    expect(JSON.parse(toJSON([])).records).toEqual([])
    expect(toJSON([])).toContain('"records": []')
  })

  it('carries the newer record fields in the same envelope', () => {
    const newer = [
      makeRecord({ kind: 'paced', practiceId: 'slow', rate: 6, rateSteps: 1, feeling: 'calmer' }),
      makeRecord({ kind: 'guided', practiceId: 'body-scan', skipped: ['knees'], note: '跳过了膝盖' }),
      makeRecord({
        kind: 'sound',
        practiceId: 'sleep',
        sound: { ambience: 'brown', music: 'none', mode: 'sleep' },
      }),
      makeRecord({
        kind: 'count',
        practiceId: 'breath-count',
        count: { cycles: 6, correct: 4, errors: 1, resets: 1, invalid: 1 },
      }),
    ]
    const data = JSON.parse(toJSON(newer, { exportedAt: new Date(Date.UTC(2026, 9, 22)) }))
    expect(Object.keys(data)).toEqual(['app', 'kind', 'version', 'exportedAt', 'records'])
    expect(data.version).toBe(EXPORT_VERSION)
    expect(parseImport(toJSON(newer))).toEqual({ records: newer, errors: [], invalid: 0 })
  })
})

describe('toCSV', () => {
  const at = new Date(2026, 9, 22, 7, 5)
  const focus = makeRecord({ at, plannedSec: 780, actualSec: 750, marks: [10, 20, 30] })
  const count = makeRecord({
    at: new Date(2026, 9, 21, 21, 30),
    practiceId: 'breath-count',
    kind: 'count',
    completed: false,
    count: { cycles: 4, correct: 3, errors: 1, resets: 2 },
    checkin: { pre: 6, post: 3 },
    sound: { ambience: 'none', music: 'pentatonic' },
  })
  const paced = makeRecord({
    at: new Date(2026, 9, 20, 12, 0),
    practiceId: 'slow',
    kind: 'paced',
    breaths: 55,
    rate: 5.5,
    sound: { ambience: 'ocean', music: 'drone' },
  })
  const labels = {
    practice: { focus: '专注', 'breath-count': '数息' },
    ambience: { stream: '溪流', none: '静默' },
    music: { pentatonic: '五声' },
  }

  it('starts with a BOM and uses CRLF line endings', () => {
    const csv = toCSV([focus])
    expect(csv.startsWith('\uFEFF')).toBe(true)
    expect(csv.endsWith('\r\n')).toBe(true)
    expect(csv.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/)
  })

  it('writes Chinese headers and one row per session in chronological order', () => {
    const rows = readCSV(toCSV([focus, count, paced], labels).slice(1))
    expect(rows[0]).toEqual([...CSV_HEADERS])
    // 数息：3 轮数对，共点了 4 次第九口、数乱 2 次，准确率 3 ÷ (4 + 2) = 50%；
    // 这条记录早于「点得太快」的统计，无效轮数按 0 计
    expect(rows.slice(1)).toEqual([
      [
        '2026-10-20',
        '12:00',
        'slow',
        '10',
        '10',
        '是',
        '',
        '',
        '',
        '55',
        '5.5',
        '',
        '',
        '',
        'ocean',
        'drone',
        '',
      ],
      [
        '2026-10-21',
        '21:30',
        '数息',
        '10',
        '10',
        '否',
        '',
        '50%',
        '0',
        '',
        '',
        '6',
        '3',
        '',
        '静默',
        '五声',
        '',
      ],
      ['2026-10-22', '07:05', '专注', '13', '12.5', '是', '3', '', '', '', '', '', '', '', '溪流', '', ''],
    ])
  })

  it('uses the exact header line', () => {
    expect(toCSV([]).split('\r\n')[0]).toBe(
      '\uFEFF日期,开始时间,练习,计划分钟,实际分钟,完成,回神次数,数息准确率,无效轮数,呼吸轮数,每分钟次数,练习前紧张度,练习后紧张度,练完感觉,声景,音乐,备注',
    )
  })

  it('reports too-fast rounds, the feeling and the note', () => {
    const fast = makeRecord({
      kind: 'count',
      practiceId: 'breath-count',
      count: { cycles: 10, correct: 6, errors: 2, resets: 1, invalid: 2 },
      feeling: 'tenser',
      note: '窗外施工，\n后来好些了, "还行"',
    })
    const row = readCSV(toCSV([fast]).slice(1))[1]
    const cell = (header: (typeof CSV_HEADERS)[number]) => row?.[CSV_HEADERS.indexOf(header)]
    // 准确率不计点得太快的轮：6 ÷ (6 + 2 + 1) ≈ 67%
    expect(cell('数息准确率')).toBe('67%')
    expect(cell('无效轮数')).toBe('2')
    expect(cell('练完感觉')).toBe('更紧张')
    expect(cell('备注')).toBe('窗外施工，\n后来好些了, "还行"')
    expect(row).toHaveLength(CSV_HEADERS.length)
  })

  it('names every feeling in Chinese and accepts other names', () => {
    const felt = (['calmer', 'same', 'tenser', 'unwell'] as const).map((feeling, i) =>
      makeRecord({ at: new Date(2026, 9, 20 + i, 8), feeling }),
    )
    const column = CSV_HEADERS.indexOf('练完感觉')
    const feelings = (csv: string) => readCSV(csv.slice(1)).map(row => row[column])
    expect(feelings(toCSV(felt))).toEqual(['练完感觉', '更平静', '差不多', '更紧张', '很不舒服'])
    expect(feelings(toCSV(felt.slice(0, 2), { feeling: { calmer: '平静了' } }))).toEqual([
      '练完感觉',
      '平静了',
      '差不多',
    ])
    expect(feelings(toCSV([makeRecord()]))).toEqual(['练完感觉', ''])
  })

  it('defuses formulas in notes too', () => {
    const csv = toCSV([makeRecord({ note: '=1+1' })])
    expect(readCSV(csv.slice(1))[1]?.at(-1)).toBe("'=1+1")
  })

  it('leaves the planned minutes of an open-ended session blank', () => {
    const sleep = makeRecord({ practiceId: 'sleep', kind: 'sound', plannedSec: 0, actualSec: 1830 })
    const row = readCSV(toCSV([sleep]).slice(1))[1]
    expect(row?.slice(3, 6)).toEqual(['', '30.5', '是'])
  })

  it('leaves the accuracy blank when no count was attempted', () => {
    const idle = makeRecord({ kind: 'count', practiceId: 'breath-count', count: zeroCount })
    expect(readCSV(toCSV([idle]).slice(1))[1]?.[7]).toBe('')
  })

  it('leaves silence blank when no label is given', () => {
    const rows = readCSV(toCSV([count]).slice(1))
    const ambience = CSV_HEADERS.indexOf('声景')
    expect(rows[1]?.slice(ambience, ambience + 2)).toEqual(['', 'pentatonic'])
  })

  it('quotes fields per RFC 4180', () => {
    const tricky = { practice: { focus: '专注, "安静"\n版' } }
    const csv = toCSV([focus], tricky)
    expect(csv).toContain('"专注, ""安静""\n版"')
    expect(readCSV(csv.slice(1))[1]?.[2]).toBe('专注, "安静"\n版')
  })

  it('defuses spreadsheet formulas', () => {
    const csv = toCSV([focus], { practice: { focus: '=HYPERLINK("http://x","y")' } })
    expect(readCSV(csv.slice(1))[1]?.[2]).toBe('\'=HYPERLINK("http://x","y")')
  })

  it('takes the practice names as a plain map, a Map or a function', () => {
    const practiceCell = (csv: string) => readCSV(csv.slice(1)).map(row => row[2])
    const expected = ['练习', 'slow', '数息', '专注']
    const plain: Partial<Record<PracticeId, string>> = { focus: '专注', 'breath-count': '数息' }
    expect(practiceCell(toCSV([focus, count, paced], plain))).toEqual(expected)
    const map = new Map<PracticeId, string>([
      ['focus', '专注'],
      ['breath-count', '数息'],
    ])
    expect(practiceCell(toCSV([focus, count, paced], map))).toEqual(expected)
    const fn = (id: PracticeId) => plain[id]
    expect(practiceCell(toCSV([focus, count, paced], fn))).toEqual(expected)
    // 内容层的目录常常这样转成表
    const fromEntries = Object.fromEntries([['focus', '专注']])
    expect(practiceCell(toCSV([focus], fromEntries))).toEqual(['练习', '专注'])
  })

  it('accepts lookups for the sound names too', () => {
    const csv = toCSV([count, paced], {
      practice: id => (id === 'slow' ? '慢呼吸' : undefined),
      ambience: new Map([['ocean', '海浪']]),
      music: { drone: '长音', pentatonic: '五声' },
    })
    const [ambience, music] = [CSV_HEADERS.indexOf('声景'), CSV_HEADERS.indexOf('音乐')]
    expect(readCSV(csv.slice(1)).map(row => [row[2], row[ambience], row[music]])).toEqual([
      ['练习', '声景', '音乐'],
      ['慢呼吸', '海浪', '长音'],
      ['breath-count', '', '五声'],
    ])
  })

  it('falls back to the id for empty names and ignores inherited keys', () => {
    const odd = { focus: '', constructor: 'x' } as Partial<Record<PracticeId, string>>
    expect(readCSV(toCSV([focus], odd).slice(1))[1]?.[2]).toBe('focus')
    const inherited = Object.create({ focus: '原型上的名字' }) as Partial<Record<PracticeId, string>>
    expect(readCSV(toCSV([focus], inherited).slice(1))[1]?.[2]).toBe('focus')
  })

  it('writes only the header for no records', () => {
    expect(toCSV([])).toBe(`\uFEFF${CSV_HEADERS.join(',')}\r\n`)
  })
})

describe('parseImport', () => {
  const records = [makeRecord({ marks: [5] }), makeRecord({ kind: 'paced', practiceId: 'box', breaths: 30 })]

  it('round-trips an export', () => {
    expect(parseImport(toJSON(records))).toEqual({ records, errors: [], invalid: 0 })
  })

  it('accepts a bare array, a BOM and surrounding whitespace', () => {
    expect(parseImport(`\uFEFF  ${JSON.stringify(records)}\n`).records).toEqual(records)
  })

  it('sanitizes every record and reports the bad ones by position', () => {
    const text = JSON.stringify([records[0], { id: 'x' }, { ...records[1], extra: 1 }, 'junk'])
    const result = parseImport(text)
    expect(result.records).toEqual([records[0], sanitizeRecord(records[1])])
    expect(result.invalid).toBe(2)
    expect(result.errors).toEqual(['第 2 条记录无法识别，已跳过', '第 4 条记录无法识别，已跳过'])
  })

  it('lists the first bad records one by one and sums up the rest', () => {
    const result = parseImport(JSON.stringify(Array.from({ length: 50 }, () => ({}))))
    expect(result.invalid).toBe(50)
    expect(result.errors).toHaveLength(MAX_IMPORT_ISSUES + 1)
    expect(result.errors[MAX_IMPORT_ISSUES - 1]).toBe(`第 ${MAX_IMPORT_ISSUES} 条记录无法识别，已跳过`)
    expect(result.errors.at(-1)).toBe(`另有 ${50 - MAX_IMPORT_ISSUES} 条记录无法识别，已跳过`)
    const exact = parseImport(JSON.stringify(Array.from({ length: MAX_IMPORT_ISSUES }, () => ({}))))
    expect(exact.errors).toHaveLength(MAX_IMPORT_ISSUES)
  })

  it('keeps the good records of a partly corrupted backup', () => {
    const good = JSON.parse(toJSON(records))
    good.records.splice(1, 0, { ...records[0], id: 42 }, null, { ...records[1], startedAt: 'gestern' })
    const result = parseImport(JSON.stringify(good))
    expect(result.records).toEqual(records)
    expect(result.invalid).toBe(3)
  })

  it('explains file-level problems', () => {
    const message = (text: string) => parseImport(text).errors[0]
    expect(message('')).toBe('文件是空的')
    expect(message('   ')).toBe('文件是空的')
    expect(message('{oops')).toBe('无法读取：文件不是有效的 JSON')
    expect(message(toCSV(records))).toBe('CSV 文件只用于查看，导入请选择 JSON 备份文件')
    expect(message(JSON.stringify({ app: 'other', records }))).toBe('这不是回神导出的文件')
    expect(message(JSON.stringify({ app: 'huishen', kind: 'prefs', records }))).toBe('这个文件不是练习记录')
    expect(message(JSON.stringify({ app: 'huishen', kind: 'records' }))).toBe('文件里没有练习记录')
    expect(message('42')).toBe('文件里没有练习记录')
    expect(parseImport('{oops').records).toEqual([])
  })

  it('warns about files from a newer version but keeps what it understands', () => {
    const result = parseImport(JSON.stringify({ app: 'huishen', kind: 'records', version: 2, records }))
    expect(result.records).toEqual(records)
    expect(result.errors).toEqual(['文件来自更新版本的回神，部分记录可能无法导入'])
  })
})

describe('downloadFile', () => {
  it('downloads through a temporary link and releases the object URL later', async () => {
    vi.useFakeTimers()
    let blob: Blob | null = null
    vi.spyOn(URL, 'createObjectURL').mockImplementation(b => {
      blob = b as Blob
      return 'blob:huishen-test'
    })
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    const clicked: { href: string; download: string; attached: boolean }[] = []
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push({ href: this.href, download: this.download, attached: document.body.contains(this) })
    })

    downloadFile('回神记录-2026-10-22.csv', MIME.csv, '\uFEFF日期\r\n')

    expect(clicked).toEqual([
      { href: 'blob:huishen-test', download: '回神记录-2026-10-22.csv', attached: true },
    ])
    expect(document.querySelector('a[download]')).toBeNull()
    expect(blob).not.toBeNull()
    const file = blob as unknown as Blob
    expect(file.type).toBe('text/csv;charset=utf-8')
    // 文件字节以 UTF-8 BOM 开头，Excel 才会按 UTF-8 读中文；Blob.text() 解码时会去掉 BOM，所以直接看字节
    const bytes = new Uint8Array(await file.arrayBuffer())
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
    expect(new TextDecoder().decode(bytes)).toBe('日期\r\n')
    expect(revoke).not.toHaveBeenCalled()
    vi.advanceTimersByTime(30_000)
    expect(revoke).toHaveBeenCalledWith('blob:huishen-test')
  })

  it('keeps an explicit charset', () => {
    let type = ''
    vi.spyOn(URL, 'createObjectURL').mockImplementation(b => {
      type = (b as Blob).type
      return 'blob:x'
    })
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    downloadFile('a.ics', 'text/calendar;charset=UTF-8', 'BEGIN:VCALENDAR')
    expect(type).toBe('text/calendar;charset=utf-8')
  })
})

describe('exportFileName', () => {
  it('names files after the local date', () => {
    expect(exportFileName('json', new Date(2026, 9, 22, 23, 59))).toBe('回神记录-2026-10-22.json')
    expect(exportFileName('csv', new Date(2026, 0, 5, 0, 1))).toBe('回神记录-2026-01-05.csv')
  })
})
