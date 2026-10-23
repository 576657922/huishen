/**
 * 测试用的记录工厂，只在测试里导入。用本地时间构造日期，测试结果才与运行机器的时区无关。
 */
import { dayKey } from '@/lib/date'
import type { SessionRecord } from './types'

let seq = 0

export interface RecordInit extends Partial<SessionRecord> {
  /** 本地开始时间，同时决定 startedAt 和 date */
  at?: Date
}

export function makeRecord({ at = new Date(2026, 9, 22, 7, 30), ...rest }: RecordInit = {}): SessionRecord {
  seq++
  return {
    v: 1,
    id: `rec-${String(seq).padStart(5, '0')}`,
    practiceId: 'focus',
    kind: 'focus',
    startedAt: at.toISOString(),
    date: dayKey(at),
    plannedSec: 600,
    actualSec: 600,
    completed: true,
    sound: { ambience: 'stream', music: 'none' },
    params: {},
    ...rest,
  }
}

/** 某个本地日期上一条指定分钟数的记录 */
export function minutesOn(day: Date, minutes: number, init: RecordInit = {}): SessionRecord {
  const at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 7, 30)
  return makeRecord({ at, actualSec: minutes * 60, plannedSec: minutes * 60, ...init })
}
