import { cx } from '../../cx'
import { figureParts, minutesText, timesText } from '../../strings'
import styles from './PracticeBars.module.css'

export interface PracticeBarRow {
  name: string
  minutes: number
  sessions: number
}

export interface PracticeBarsProps {
  /** 一个练习一行，按调用方给的顺序 */
  rows: readonly PracticeBarRow[]
  className?: string
}

/**
 * 各练习（DESIGN.md §8.9 PracticeBars）：名称 112 | 6 px 的次级墨色横条 | 「150 分钟 · 15 次」128，横条占剩下的宽度
 * （手机 350 的栏里约 88）。条的根部方、数据端圆 3；最短 3 px，练过就看得见。条只是示意，数字写在右边
 */
export function PracticeBars({ rows, className }: PracticeBarsProps) {
  const max = Math.max(1, ...rows.map(r => r.minutes))
  return (
    <ul className={cx(styles.bars, className)}>
      {rows.map(r => {
        const parts = figureParts(minutesText(r.minutes))
        return (
          <li key={r.name} className={styles.row}>
            <span className={styles.name}>{r.name}</span>
            <span className={styles.track} aria-hidden="true">
              <span className={styles.bar} style={{ width: `max(3px, ${(r.minutes / max) * 100}%)` }} />
            </span>
            <span className={styles.value}>
              {parts ? (
                <>
                  <span className={cx('pnum', styles.figure)}>{parts.figure}</span>
                  {` ${parts.unit} · ${timesText(r.sessions)}`}
                </>
              ) : (
                `${minutesText(r.minutes)} · ${timesText(r.sessions)}`
              )}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
