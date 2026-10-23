import { cx } from '../../cx'
import { sparkGeometry } from '../../figures/plots'
import { n } from '../../figures/svg'
import styles from './Sparkline.module.css'

export interface SparklineProps {
  /** 每次的值，按时间先后（数息准确率 0–1） */
  values: readonly number[]
  /** 固定的刻度，默认 50–100% */
  domain?: readonly [number, number]
  /** 最近一次是今天练的：最后那个点用朱色 */
  lastIsToday?: boolean
  /** 读屏用的整句（日期和数值） */
  label: string
  className?: string
}

/**
 * 走势小图（DESIGN.md §8.9，记录 · 数息，满 3 次后才显示）：120 × 32，2 px 墨线，每次 4 px 的点，
 * 最近一次 8 px；没有坐标轴。最近一次的数值由调用方印在右边，配「最近一次」。
 */
export function Sparkline({
  values,
  domain = [0.5, 1],
  lastIsToday = false,
  label,
  className,
}: SparklineProps) {
  const g = sparkGeometry(values, domain)
  return (
    <svg
      className={cx(styles.spark, className)}
      width={g.width}
      height={g.height}
      viewBox={`0 0 ${g.width} ${g.height}`}
      role="img"
      aria-label={label}
    >
      <path className={styles.line} d={g.d} />
      {g.dots.map((d, i) => (
        <circle
          key={d.key}
          className={cx(styles.dot, lastIsToday && i === g.dots.length - 1 && styles.now)}
          cx={n(d.cx)}
          cy={n(d.cy)}
          r={d.r}
        />
      ))}
    </svg>
  )
}
