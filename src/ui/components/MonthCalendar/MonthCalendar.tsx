import { cx } from '../../cx'
import { monthGeometry } from '../../figures/calendar'
import { n } from '../../figures/svg'
import { monthCalendarLabel } from '../../strings'
import styles from './MonthCalendar.module.css'

export interface MonthCalendarProps {
  year: number
  /** 1–12 */
  month: number
  /** 练过的日子（YYYY-MM-DD） */
  practised: ReadonlySet<string>
  /** 今天（YYYY-MM-DD）；不在这个月时不标 */
  today?: string | null
  label?: string
  className?: string
}

/**
 * 月历点阵（DESIGN.md §8.9）：七列、周一在前，每格 50 × 44；日期数字在格子上方（11 号三级墨色），
 * 练过的日子下面一个 10 px 实心墨点，没练的什么都不画；今天的数字朱色 600，下面一道 10 px 朱色短线。
 * 不按分钟着色，不做热力图。
 */
export function MonthCalendar({
  year,
  month,
  practised,
  today = null,
  label,
  className,
}: MonthCalendarProps) {
  const g = monthGeometry(year, month, practised, today)
  const todayCell = g.cells.find(c => c.today)
  return (
    <svg
      className={cx(styles.cal, className)}
      width={g.width}
      height={g.height}
      viewBox={`0 0 ${g.width} ${g.height}`}
      role="img"
      aria-label={label ?? monthCalendarLabel(month, g.practisedCount, todayCell?.day ?? null)}
    >
      {g.weekdays.map(w => (
        <text key={w.x} className={styles.weekday} x={w.x} y={12} textAnchor="middle">
          {w.label}
        </text>
      ))}
      <path className={styles.rule} d={`M0 ${g.head - 0.5}H${g.width}`} />
      {g.cells.map(c => (
        <g key={c.date}>
          <text
            className={cx(styles.day, c.today && styles.today)}
            x={c.cx}
            y={c.top + 15}
            textAnchor="middle"
          >
            {c.day}
          </text>
          {c.today && (
            <path className={styles.todayRule} d={`M${n(c.cx - 5)} ${n(c.top + 19.25)}H${n(c.cx + 5)}`} />
          )}
          {c.practised && <circle className={styles.dot} cx={c.cx} cy={c.top + 31} r={5} />}
        </g>
      ))}
    </svg>
  )
}
