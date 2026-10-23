import { cx } from '../../cx'
import { type DotPoint, dotPlotGeometry } from '../../figures/plots'
import { n } from '../../figures/svg'
import styles from './DotPlot.module.css'

export interface DotPlotProps {
  /** 每次专注呼吸一个点：日期、每 10 分钟回神次数；今天的点朱色 */
  points: readonly DotPoint[]
  /** 横轴的起止日期（YYYY-MM-DD） */
  from: string
  to: string
  /** 读屏用的整句：图里的数用文字说一遍（§8.9） */
  label: string
  width?: number
  height?: number
  className?: string
}

/**
 * 回神次数点图（DESIGN.md §8.9）：x 是日期，y 是每 10 分钟回神次数，纵轴 0–10（超过时延到下一个 5 的倍数）；
 * 0 / 5 / 10 的细线，0 那条用线色；每次一个 8 px 次级墨色点、带底色描边。没有趋势线、平均线和目标线。
 */
export function DotPlot({ points, from, to, label, width = 350, height = 160, className }: DotPlotProps) {
  const g = dotPlotGeometry(points, from, to, width, height)
  return (
    <svg
      className={cx(styles.plot, className)}
      width={g.width}
      height={g.height}
      viewBox={`0 0 ${g.width} ${g.height}`}
      role="img"
      aria-label={label}
    >
      {g.grid.map(line => (
        <g key={line.value}>
          <path
            className={cx(styles.grid, line.value === 0 && styles.base)}
            d={`M${g.padL} ${n(line.y + 0.5)}H${g.width}`}
          />
          <text className={styles.axis} x={g.padL - 8} y={n(line.y + 4)} textAnchor="end">
            {line.value}
          </text>
        </g>
      ))}
      {g.ticks.map(t => (
        <g key={t.label}>
          <path className={styles.tick} d={`M${n(t.x)} ${n(g.baseY + 1)}v4`} />
          <text className={styles.axis} x={n(t.x)} y={g.height - 6} textAnchor="middle">
            {t.label}
          </text>
        </g>
      ))}
      {g.dots.map(d => (
        <circle
          key={d.key}
          className={cx(styles.dot, d.today && styles.now)}
          cx={n(d.cx)}
          cy={n(d.cy)}
          r={4}
        />
      ))}
    </svg>
  )
}
