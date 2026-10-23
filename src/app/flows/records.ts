/**
 * 记录的同步快照。开始练习要在点击处理里同步决定（声音只能在手势里解锁），
 * 不能等 IndexedDB 的异步读取，所以这里常驻一份最新的记录列表。
 */
import type { SessionRecord } from '@/data'
import { dayKey } from '@/lib/date'
import { getRepo } from '../services'

let latest: readonly SessionRecord[] = []
let stop: (() => void) | null = null

/** 开始跟踪记录（启动时调用一次）；返回停止跟踪 */
export function watchRecords(): () => void {
  if (stop) return stop
  const repo = getRepo()
  let seq = 0
  const load = (): void => {
    // 连续变化时只采用最后一次读取
    const id = ++seq
    repo.all().then(
      records => {
        if (id === seq) latest = records
      },
      () => undefined,
    )
  }
  const off = repo.subscribe(load)
  load()
  stop = () => {
    off()
    stop = null
    latest = []
  }
  return stop
}

/** 最新的记录，按开始时间倒序；启动后第一次读完之前为空 */
export const latestRecords = (): readonly SessionRecord[] => latest

/**
 * 今天上一次练习选了「很不舒服」：这时不再先问「此刻有多紧张？」（DESIGN.md §13.5.13）。
 * records 按开始时间倒序
 */
export function unwellJustBefore(records: readonly SessionRecord[], now: Date = new Date()): boolean {
  const today = dayKey(now)
  const last = records.find(r => r.date === today)
  return last?.feeling === 'unwell'
}
