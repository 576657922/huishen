/**
 * 舒适节律探索（PRODUCT.md §2、DESIGN.md §8.15.12、§13.11）：五档各是一次 60 秒的短会话
 * （startPractice({ practiceId: 'pace-finder', from: 'pace-finder', overrides: { params: { rate, step } } })），
 * 每档结束后流程不存记录、不出小结，结果放在 sessionStore 的 summary.result 里给页面读。
 * 一整轮走完（或中途停下）后，页面用这里把各档合成一条记录。
 */
import { isRecordable, type RecordExtras, resultToRecord, type SessionRecord } from '@/data'
import type { SessionResult } from '@/engine'
import { getRepo } from '../services'

/**
 * 把一整轮的各档合成一条记录存下：秒数相加，满 1 分钟才记；params 记档数 steps 和选定的节律 rate（选了才有）。
 * 心率带的数据（实验）照 RecordExtras.hrv 传。返回存下的记录，没记时为 null
 */
export async function savePaceFinderRun(
  steps: readonly SessionResult[],
  extras: { chosenRate?: number; hrv?: RecordExtras['hrv'] } = {},
): Promise<SessionRecord | null> {
  const first = steps[0]
  if (!first) return null
  const sum = (f: (r: SessionResult) => number): number => steps.reduce((total, r) => total + f(r), 0)
  const params: Record<string, number | string> = { steps: steps.length }
  if (extras.chosenRate !== undefined) params.rate = extras.chosenRate
  const run: SessionResult = {
    plan: { ...first.plan, plannedSec: sum(r => r.plan.plannedSec), params },
    startedAt: first.startedAt,
    practicedSec: sum(r => r.practicedSec),
    completed: steps.every(r => r.completed),
    marks: [],
    count: null,
    breaths: sum(r => r.breaths ?? 0),
    finalRate: extras.chosenRate ?? null,
    rateSteps: 0,
    skipped: [],
  }
  if (!isRecordable(run)) return null
  const record = resultToRecord(run, extras.hrv ? { hrv: extras.hrv } : {})
  await getRepo().add(record)
  return record
}
