import { cx } from '../../cx'
import { type WeekDay, weekDotsGeometry } from '../../figures/calendar'
import { n } from '../../figures/svg'
import { weekDotsLabel } from '../../strings'
import styles from './WeekDots.module.css'

export interface WeekDotsProps {
  /** 周一到周日七天 */
  days: readonly WeekDay[]
  /** phone：每格 24、点 8；desk：每格 30、点 10 */
  size?: 'phone' | 'desk'
  /** 读屏用的整句；默认按「本周，练过 3 天：周一、周三、周四；今天是周四」拼 */
  label?: string
  className?: string
}

/**
 * 本周的点（DESIGN.md §8.9）：练过的一天是一个实心墨点；没练的日子——过去的、还没到的——只有星期名，
 * 什么都不画，从不标红。今天的星期名是朱色 600，下面一道 10 × 1.5 的朱色短线。只表示频率，不画分钟。
 */
export function WeekDots({ days, size = 'phone', label, className }: WeekDotsProps) {
  const g = weekDotsGeometry(days, size)
  const practised = g.slots.filter(s => s.practised).map(s => s.label)
  const today = g.slots.find(s => s.state === 'today')
  return (
    <svg
      className={cx(styles.weekdots, className)}
      width={g.width}
      height={g.height}
      viewBox={`0 0 ${g.width} ${n(g.height)}`}
      role="img"
      aria-label={label ?? weekDotsLabel(practised, today?.label ?? null)}
    >
      {g.slots.map(s => (
        <g key={`${s.cx}`}>
          {s.practised && <circle className={styles.dot} cx={s.cx} cy={g.dotY} r={g.dotR} />}
          <text
            className={cx(
              styles.label,
              s.state === 'future' && styles.future,
              s.state === 'today' && styles.today,
            )}
            x={s.cx}
            y={g.labelY}
            textAnchor="middle"
          >
            {s.label}
          </text>
          {s.state === 'today' && (
            <path className={styles.rule} d={`M${n(s.cx - 5)} ${n(g.ruleY)}H${n(s.cx + 5)}`} />
          )}
        </g>
      ))}
    </svg>
  )
}
