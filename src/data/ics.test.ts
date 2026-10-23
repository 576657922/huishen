import { describe, expect, it } from 'vitest'
import {
  buildPlanICS,
  buildReminderICS,
  buildRemindersICS,
  EVERY_DAY,
  escapeText,
  foldLine,
  PLAN_OBSTACLE,
  planSentence,
  REMINDER_FILE_NAME,
  type ReminderEvent,
  WEEKEND,
  type Weekday,
  WORKDAYS,
} from './ics'
import type { Reminders } from './types'

const encoder = new TextEncoder()
const octets = (line: string): number => encoder.encode(line).length
const physicalLines = (ics: string): string[] => ics.split('\r\n').slice(0, -1)
const unfold = (ics: string): string[] => physicalLines(ics.replace(/\r\n /g, ''))
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/
const field = (ics: string, name: string): string[] =>
  unfold(ics)
    .filter(l => l.startsWith(`${name}:`))
    .map(l => l.slice(name.length + 1))

// 2026-10-23 是星期五
const base: ReminderEvent = {
  time: '07:30',
  title: '回神 · 每日练习',
  description: '找一个安静的地方坐下，练 10 分钟。',
  url: 'https://huishen.example/practice?from=calendar',
  startDate: new Date(2026, 9, 23),
  uid: 'daily@huishen',
  now: new Date(Date.UTC(2026, 9, 22, 13, 4, 5)),
}

describe('buildReminderICS structure', () => {
  it('produces a complete daily VEVENT with an alarm', () => {
    expect(unfold(buildReminderICS(base))).toEqual([
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Huishen//Practice Reminder//ZH',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      'UID:daily@huishen',
      'DTSTAMP:20261022T130405Z',
      // 2026-01-01 00:00 UTC 起的分钟数：294 天 13 小时 4 分
      'SEQUENCE:424144',
      'DTSTART:20261023T073000',
      'DURATION:PT10M',
      'RRULE:FREQ=DAILY',
      'SUMMARY:回神 · 每日练习',
      'DESCRIPTION:找一个安静的地方坐下，练 10 分钟。',
      'URL:https://huishen.example/practice?from=calendar',
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      'TRIGGER:PT0M',
      'DESCRIPTION:回神 · 每日练习',
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR',
    ])
  })

  it('uses CRLF everywhere and ends with a line break', () => {
    const ics = buildReminderICS(base)
    expect(ics.endsWith('\r\n')).toBe(true)
    expect(ics.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/)
  })

  it('starts at floating local time so the habit follows the user across time zones', () => {
    const ics = buildReminderICS({ ...base, time: '21:05', startDate: new Date(2026, 0, 1, 23, 59) })
    expect(ics).toContain('DTSTART:20260101T210500\r\n')
    expect(ics).not.toContain('TZID')
    expect(ics).not.toMatch(/DTSTART:[^\r]*Z/)
  })

  it('stamps the creation time in UTC', () => {
    const ics = buildReminderICS({ ...base, now: new Date(Date.UTC(2027, 0, 2, 3, 4, 5)) })
    expect(ics).toContain('DTSTAMP:20270102T030405Z\r\n')
  })

  it('accepts another duration within sane bounds', () => {
    expect(buildReminderICS({ ...base, minutes: 13 })).toContain('DURATION:PT13M\r\n')
    expect(buildReminderICS({ ...base, minutes: 0 })).toContain('DURATION:PT1M\r\n')
    expect(buildReminderICS({ ...base, minutes: 9999 })).toContain('DURATION:PT1440M\r\n')
    expect(buildReminderICS({ ...base, minutes: Number.NaN })).toContain('DURATION:PT10M\r\n')
  })

  it('only links to http(s) addresses', () => {
    const without = (url: string | undefined) =>
      unfold(buildReminderICS({ ...base, url })).some(l => l.startsWith('URL'))
    expect(without(undefined)).toBe(false)
    expect(without('javascript:alert(1)')).toBe(false)
    expect(without('not a url')).toBe(false)
    expect(without('http://localhost:5173/')).toBe(true)
  })

  it('rejects invalid times and dates', () => {
    expect(() => buildReminderICS({ ...base, time: '7:30' })).toThrow(RangeError)
    expect(() => buildReminderICS({ ...base, time: '24:00' })).toThrow(RangeError)
    expect(() => buildReminderICS({ ...base, startDate: new Date(Number.NaN) })).toThrow(RangeError)
    expect(() => buildReminderICS({ ...base, now: new Date(Number.NaN) })).toThrow(RangeError)
  })

  it('names the file for download', () => {
    expect(REMINDER_FILE_NAME).toMatch(/\.ics$/)
  })
})

describe('updating a reminder by importing it again', () => {
  const withoutUid = { ...base, uid: undefined }

  it('uses a stable UID per schedule, so a new time replaces the old reminder', () => {
    const uid = (event: ReminderEvent) => field(buildReminderICS(event), 'UID')
    expect(uid(withoutUid)).toEqual(['reminder-daily@huishen'])
    expect(uid({ ...withoutUid, time: '21:00' })).toEqual(['reminder-daily@huishen'])
    expect(uid({ ...withoutUid, days: WORKDAYS })).toEqual(['reminder-workdays@huishen'])
    expect(uid({ ...withoutUid, days: WEEKEND })).toEqual(['reminder-weekend@huishen'])
    expect(uid({ ...withoutUid, days: ['FR', 'MO'] })).toEqual(['reminder-mo-fr@huishen'])
  })

  it('raises SEQUENCE over time so calendars take the newer version', () => {
    const seq = (now: Date) => Number(field(buildReminderICS({ ...base, now }), 'SEQUENCE')[0])
    const earlier = seq(new Date(Date.UTC(2026, 9, 22, 13, 4)))
    const later = seq(new Date(Date.UTC(2026, 9, 22, 13, 6)))
    expect(later).toBeGreaterThan(earlier)
    expect(seq(new Date(Date.UTC(2025, 0, 1)))).toBe(0)
  })
})

describe('reminder days', () => {
  it('repeats on workdays only, starting on the first workday', () => {
    // 从周六开始：第一次提醒顺延到周一，DTSTART 本身就落在规则里
    const ics = buildReminderICS({ ...base, days: WORKDAYS, startDate: new Date(2026, 9, 24) })
    expect(field(ics, 'RRULE')).toEqual(['FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR'])
    expect(field(ics, 'DTSTART')).toEqual(['20261026T073000'])
  })

  it('repeats on weekends only, starting on the coming Saturday', () => {
    const ics = buildReminderICS({ ...base, time: '09:00', days: WEEKEND })
    expect(field(ics, 'RRULE')).toEqual(['FREQ=WEEKLY;BYDAY=SA,SU'])
    expect(field(ics, 'DTSTART')).toEqual(['20261024T090000'])
  })

  it('keeps the start date when it is already a reminder day', () => {
    expect(field(buildReminderICS({ ...base, days: WORKDAYS }), 'DTSTART')).toEqual(['20261023T073000'])
  })

  it('normalizes the order, removes duplicates and treats all seven days as daily', () => {
    const custom = buildReminderICS({ ...base, days: ['SU', 'WE', 'MO', 'WE'] })
    expect(field(custom, 'RRULE')).toEqual(['FREQ=WEEKLY;BYDAY=MO,WE,SU'])
    expect(field(custom, 'DTSTART')).toEqual(['20261025T073000'])
    const all: Weekday[] = ['SU', 'SA', 'FR', 'TH', 'WE', 'TU', 'MO']
    expect(field(buildReminderICS({ ...base, days: all }), 'RRULE')).toEqual(['FREQ=DAILY'])
    expect(EVERY_DAY).toHaveLength(7)
  })

  it('crosses a month end when finding the first reminder day', () => {
    const ics = buildReminderICS({ ...base, days: ['MO'], startDate: new Date(2026, 9, 27) })
    expect(field(ics, 'DTSTART')).toEqual(['20261102T073000'])
  })

  it('refuses a reminder that would never ring', () => {
    expect(() => buildReminderICS({ ...base, days: [] })).toThrow(RangeError)
    expect(() => buildReminderICS({ ...base, days: ['XX' as Weekday] })).toThrow(RangeError)
    expect(() => buildReminderICS({ ...base, days: ['MO', 'mo' as Weekday] })).toThrow(RangeError)
  })
})

describe('buildRemindersICS', () => {
  const workday: ReminderEvent = { ...base, uid: undefined, days: WORKDAYS }
  const weekend: ReminderEvent = { ...base, uid: undefined, time: '09:00', days: WEEKEND }

  it('puts workday and weekend reminders into one calendar', () => {
    const ics = buildRemindersICS([workday, weekend])
    const lines = unfold(ics)
    expect(lines.filter(l => l === 'BEGIN:VCALENDAR')).toHaveLength(1)
    expect(lines.filter(l => l === 'BEGIN:VEVENT')).toHaveLength(2)
    expect(lines.filter(l => l === 'BEGIN:VALARM')).toHaveLength(2)
    expect(field(ics, 'UID')).toEqual(['reminder-workdays@huishen', 'reminder-weekend@huishen'])
    expect(field(ics, 'DTSTART')).toEqual(['20261023T073000', '20261024T090000'])
    expect(lines.at(-1)).toBe('END:VCALENDAR')
  })

  it('is what buildReminderICS produces for a single reminder', () => {
    expect(buildRemindersICS([base])).toBe(buildReminderICS(base))
  })

  it('refuses an empty list and clashing UIDs', () => {
    expect(() => buildRemindersICS([])).toThrow(RangeError)
    expect(() => buildRemindersICS([workday, { ...workday, time: '12:00' }])).toThrow(/UID/)
    expect(() => buildRemindersICS([workday, { ...workday, uid: 'lunch@huishen' }])).not.toThrow()
  })
})

describe('escapeText', () => {
  it('escapes backslash, semicolon, comma and newlines', () => {
    expect(escapeText('a\\b;c,d\ne\r\nf\rg')).toBe('a\\\\b\\;c\\,d\\ne\\nf\\ng')
  })

  it('leaves full-width punctuation and tabs alone and drops other controls', () => {
    expect(escapeText('坐下，呼吸；放松')).toBe('坐下，呼吸；放松')
    expect(escapeText('a\tb\u0007c')).toBe('a\tbc')
  })

  it('is applied to every text property', () => {
    const ics = buildReminderICS({ ...base, title: 'A, B; C', description: '第一行\n第二行', uid: 'x,y' })
    const lines = unfold(ics)
    expect(lines).toContain('SUMMARY:A\\, B\\; C')
    expect(lines).toContain('DESCRIPTION:第一行\\n第二行')
    expect(lines).toContain('UID:x\\,y')
  })
})

describe('line folding', () => {
  it('keeps every physical line within 75 octets', () => {
    const ics = buildReminderICS({
      ...base,
      title: '回神'.repeat(40),
      description: `${'找一个安静的地方坐下。'.repeat(30)} ${'a'.repeat(200)} 🧘‍♀️🌊`.repeat(2),
      url: `https://huishen.example/${'p'.repeat(150)}`,
    })
    for (const line of physicalLines(ics)) expect(octets(line)).toBeLessThanOrEqual(75)
  })

  it('folds Chinese text by bytes, never inside a character', () => {
    const title = '安'.repeat(60)
    const lines = physicalLines(buildReminderICS({ ...base, title }))
    const start = lines.findIndex(l => l.startsWith('SUMMARY:'))
    // 「SUMMARY:」占 8 个八位组，再放 22 个汉字是 74；第 23 个会超过 75
    expect(lines[start]).toBe(`SUMMARY:${'安'.repeat(22)}`)
    // 续行以空格开头：1 + 24 × 3 = 73，再多一个汉字就是 76
    expect(lines[start + 1]).toBe(` ${'安'.repeat(24)}`)
    expect(lines[start + 2]).toBe(` ${'安'.repeat(14)}`)
    expect(lines[start + 3]?.startsWith(' ')).toBe(false)
  })

  it('folds ASCII at exactly 75 octets', () => {
    const folded = foldLine(`DESCRIPTION:${'a'.repeat(200)}`).split('\r\n')
    // 「DESCRIPTION:」12 个八位组 + 63 个 a；续行 1 个空格 + 74 个 a；剩下 63 个 a
    expect(folded.map(octets)).toEqual([75, 75, 64])
    expect(folded.slice(1).every(l => l.startsWith(' '))).toBe(true)
  })

  it('never splits a four-byte character such as an emoji', () => {
    const folded = foldLine(`SUMMARY:${'🌊'.repeat(40)}`).split('\r\n')
    for (const line of folded) {
      expect(octets(line)).toBeLessThanOrEqual(75)
      expect(line).not.toMatch(LONE_SURROGATE)
    }
    expect(folded.join('').replace(/ /g, '')).toBe(`SUMMARY:${'🌊'.repeat(40)}`)
  })

  it('unfolds back to the original content', () => {
    const description = `${'练习'.repeat(50)}, ${'x'.repeat(90)}; 🧘`
    const lines = unfold(buildReminderICS({ ...base, description }))
    expect(lines).toContain(`DESCRIPTION:${escapeText(description)}`)
  })

  it('leaves short lines alone', () => {
    expect(foldLine('VERSION:2.0')).toBe('VERSION:2.0')
    expect(foldLine('')).toBe('')
  })
})

const PLAN: Reminders = {
  cue: '刷牙后',
  action: '3 分钟呼吸',
  fallback: '1 分钟',
  weekday: '07:30',
  weekend: '09:00',
}

describe('planSentence', () => {
  it('writes the implementation intention as one sentence', () => {
    expect(planSentence(PLAN)).toBe('在刷牙后，我会做 3 分钟呼吸；如果太累，就只做 1 分钟。')
    expect(PLAN_OBSTACLE).toBe('太累')
  })

  it('leaves out the parts left blank', () => {
    expect(planSentence({ ...PLAN, fallback: '' })).toBe('在刷牙后，我会做 3 分钟呼吸。')
    expect(planSentence({ ...PLAN, cue: '  ' })).toBe('我会做 3 分钟呼吸；如果太累，就只做 1 分钟。')
    expect(planSentence({ cue: '', action: '', fallback: '' })).toBe('我会做练习。')
  })

  it('does not repeat the words the sentence already has, or the punctuation it adds', () => {
    // 用户在空格里又写了「在」「做」「只做」，或者顺手加了标点
    expect(planSentence({ cue: '在刷牙后，', action: '做 3 分钟呼吸。', fallback: '只做 1 分钟' })).toBe(
      '在刷牙后，我会做 3 分钟呼吸；如果太累，就只做 1 分钟。',
    )
    expect(planSentence({ cue: ' 在 ', action: '我会做慢呼吸', fallback: '就只做一分钟！' })).toBe(
      '我会做慢呼吸；如果太累，就只做一分钟。',
    )
    // 只去掉开头与句子重复的词，句子随后会补回来，意思不变；中间的字不动
    expect(planSentence({ cue: '在家吃完早饭后', action: '做饭前呼吸', fallback: '做 1 轮' })).toBe(
      '在家吃完早饭后，我会做饭前呼吸；如果太累，就只做 1 轮。',
    )
    expect(planSentence({ cue: '早饭后在阳台', action: '3 分钟', fallback: '' })).toBe(
      '在早饭后在阳台，我会做 3 分钟。',
    )
    expect(planSentence({ cue: '', action: '做。', fallback: '，' })).toBe('我会做练习。')
  })

  it('spaces Chinese from numbers and Latin letters where the parts meet', () => {
    expect(planSentence({ cue: '7 点起床后', action: 'box breathing', fallback: '1 分钟' })).toBe(
      '在 7 点起床后，我会做 box breathing；如果太累，就只做 1 分钟。',
    )
    expect(planSentence({ cue: '午饭后', action: '慢呼吸 5 分钟', fallback: '' })).toBe(
      '在午饭后，我会做慢呼吸 5 分钟。',
    )
  })
})

describe('buildPlanICS', () => {
  const options = {
    startDate: new Date(2026, 9, 23),
    now: new Date(Date.UTC(2026, 9, 22, 13, 4, 5)),
    url: 'https://huishen.example/',
  }

  it('puts the weekday and weekend reminders into one calendar', () => {
    const ics = buildPlanICS(PLAN, options)
    const lines = unfold(ics)
    expect(lines.filter(l => l === 'BEGIN:VCALENDAR')).toHaveLength(1)
    expect(lines.filter(l => l === 'BEGIN:VEVENT')).toHaveLength(2)
    expect(lines.filter(l => l === 'BEGIN:VALARM')).toHaveLength(2)
    expect(field(ics, 'RRULE')).toEqual(['FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR', 'FREQ=WEEKLY;BYDAY=SA,SU'])
    // 2026-10-23 是周五：工作日从当天开始，周末从次日周六开始
    expect(field(ics, 'DTSTART')).toEqual(['20261023T073000', '20261024T090000'])
    expect(field(ics, 'UID')).toEqual(['reminder-workdays@huishen', 'reminder-weekend@huishen'])
    expect(field(ics, 'SUMMARY')).toEqual(['回神 · 3 分钟呼吸', '回神 · 3 分钟呼吸'])
    expect(field(ics, 'URL')).toEqual(['https://huishen.example/', 'https://huishen.example/'])
    expect(new Set(field(ics, 'SEQUENCE')).size).toBe(1)
    expect(lines.at(-1)).toBe('END:VCALENDAR')
  })

  it('puts the plan sentence in the description of each event', () => {
    const sentence = '在刷牙后，我会做 3 分钟呼吸；如果太累，就只做 1 分钟。'
    // 每个事件两行：事件的说明，以及提醒弹出时的说明
    expect(field(buildPlanICS(PLAN, options), 'DESCRIPTION')).toEqual([
      sentence,
      '回神 · 3 分钟呼吸',
      sentence,
      '回神 · 3 分钟呼吸',
    ])
  })

  it('escapes what the user typed and folds a long plan by octets', () => {
    const plan = { ...PLAN, cue: 'lunch, then coffee; done', action: `${'慢慢地呼吸'.repeat(12)} 10 分钟` }
    const ics = buildPlanICS(plan, options)
    expect(field(ics, 'DESCRIPTION')[0]).toBe(
      `在 lunch\\, then coffee\\; done，我会做${'慢慢地呼吸'.repeat(12)} 10 分钟；如果太累，就只做 1 分钟。`,
    )
    for (const line of physicalLines(ics)) expect(octets(line)).toBeLessThanOrEqual(75)
  })

  it('makes only the reminders that have a time', () => {
    const weekdays = buildPlanICS({ ...PLAN, weekend: null }, options)
    expect(field(weekdays, 'RRULE')).toEqual(['FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR'])
    const weekend = buildPlanICS({ ...PLAN, weekday: null }, options)
    expect(field(weekend, 'RRULE')).toEqual(['FREQ=WEEKLY;BYDAY=SA,SU'])
    expect(field(weekend, 'UID')).toEqual(['reminder-weekend@huishen'])
  })

  it('refuses a plan without a reminder time, or with a broken one', () => {
    expect(() => buildPlanICS({ ...PLAN, weekday: null, weekend: null }, options)).toThrow(RangeError)
    expect(() => buildPlanICS({ ...PLAN, weekday: '7:30' }, options)).toThrow(RangeError)
  })

  it('blocks out the minutes the plan names, 10 by default', () => {
    expect(field(buildPlanICS(PLAN, options), 'DURATION')).toEqual(['PT3M', 'PT3M'])
    expect(field(buildPlanICS({ ...PLAN, action: '慢呼吸' }, options), 'DURATION')).toEqual([
      'PT10M',
      'PT10M',
    ])
    expect(field(buildPlanICS(PLAN, { ...options, minutes: 13 }), 'DURATION')).toEqual(['PT13M', 'PT13M'])
    expect(field(buildPlanICS({ ...PLAN, action: '  ' }, options), 'SUMMARY')[0]).toBe('回神 · 练习')
    expect(field(buildPlanICS({ ...PLAN, action: '做 3 分钟呼吸。' }, options), 'SUMMARY')[0]).toBe(
      '回神 · 3 分钟呼吸',
    )
  })
})
