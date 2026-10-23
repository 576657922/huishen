import { RECORDS } from '@/content/copy'
import { cx } from '../../cx'
import { checkinGeometry, median } from '../../figures/plots'
import { n } from '../../figures/svg'
import { checkinLabel } from '../../strings'
import { useFigureWidth } from '../../useFigureWidth'
import styles from './CheckinStrips.module.css'

export interface CheckinStripsProps {
  /** 练习前的分数（0–10），每对一次 */
  before: readonly number[]
  after: readonly number[]
  /** 中位数；不给时在这里算（data 的 checkinSummary 已经算好时传进来，两处一致） */
  medians?: { before: number; after: number }
  /** 读屏的整句；默认「练习前后自评（0–10）：练习前中位数 6，练习后中位数 4，各 19 次」 */
  label?: string
  /** 不给时占满所在的栏 */
  width?: number
  className?: string
}

/**
 * 练习前后自评（DESIGN.md §8.9 CheckinStrips）：「练习前」「练习后」两行共用一根 0–10 的轴；相同的回答聚成
 * 三个点宽的一小团往上摞；每行一条 1.5 px 的墨色竖线标中位数。没有箭头、没有差值——两个中位数由页面印在图上方。
 * 满 5 对才显示（页面决定），之前显示 RECORDS.checkin.notEnough。
 */
export function CheckinStrips({ before, after, medians, label, width, className }: CheckinStripsProps) {
  const [ref, w] = useFigureWidth<HTMLDivElement>(width, 350)
  const meds = medians ?? { before: median(before), after: median(after) }
  const g = checkinGeometry({ before, after, medians: meds, width: w })
  const rowLabel = { before: RECORDS.checkin.before, after: RECORDS.checkin.after }
  return (
    <div ref={ref} className={cx(styles.frame, className)}>
      <svg
        className={styles.strips}
        width={g.width}
        height={g.height}
        viewBox={`0 0 ${g.width} ${g.height}`}
        role="img"
        aria-label={label ?? checkinLabel(meds, Math.min(before.length, after.length))}
      >
        {g.grid.map(l => (
          <path key={l.key} className={cx(styles.grid, l.major && styles.major)} d={l.d} />
        ))}
        {g.axis.map(a => (
          <text key={a.key} className={styles.axis} x={n(a.x)} y={a.y} textAnchor="middle">
            {a.text}
          </text>
        ))}
        {g.rows.map(row => (
          <g key={row.key}>
            <text className={styles.label} x={0} y={row.labelY}>
              {rowLabel[row.key]}
            </text>
            <path className={styles.base} d={row.base} />
            <path className={styles.median} d={row.median} />
            {row.dots.map(d => (
              <circle key={d.key} className={styles.dot} cx={n(d.cx)} cy={n(d.cy)} r={g.r} />
            ))}
          </g>
        ))}
      </svg>
    </div>
  )
}
