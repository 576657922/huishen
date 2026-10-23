import { TODAY } from '@/content/copy'
import { cx } from '../../cx'
import { n } from '../../figures/svg'
import { focusTimelineGeometry } from '../../figures/timeline'
import { focusTimelineLabel } from '../../strings'
import { useFigureWidth } from '../../useFigureWidth'
import styles from './FocusTimeline.module.css'

export interface FocusTimelineProps {
  /** 这次练习几分钟（播放器：计划时长；小结：练了多久） */
  minutes: number
  /** 每次回神在第几秒 */
  marks: readonly number[]
  /** 播放器里的现在（秒）；小结里不给，整段都已过去 */
  t?: number | null
  /** 读屏的整句；默认「回神 6 次，分别在 1 分 36 秒、……」 */
  label?: string
  /** 不给时占满所在的栏 */
  width?: number
  className?: string
}

/**
 * 回神时间线（DESIGN.md §8.15.8）：过去的基线 1.5 px 次级墨色，将来的是 1.5 px 线色点线；每次回神一道 2 px、
 * 16 高的墨色竖线；每分钟一个刻度（每 5 分钟长一点），标签在 0、5、10 和结束（「15 分钟」）；现在是 8 px 的朱色点。
 */
export function FocusTimeline({ minutes, marks, t = null, label, width, className }: FocusTimelineProps) {
  const [ref, w] = useFigureWidth<HTMLDivElement>(width, 350)
  const g = focusTimelineGeometry({ width: w, minutes, marks, t, endLabel: TODAY.minutes })
  return (
    <div ref={ref} className={cx(styles.frame, className)}>
      <svg
        className={styles.timeline}
        width={g.width}
        height={g.height}
        viewBox={`0 0 ${g.width} ${g.height}`}
        role="img"
        aria-label={label ?? focusTimelineLabel(marks)}
      >
        <path className={styles.past} d={g.past} />
        {g.future && <path className={styles.future} d={g.future} />}
        {g.ticks.map(tk => (
          <path key={tk.key} className={styles.tick} d={tk.d} />
        ))}
        {g.minor.map(m => (
          <path key={m.key} className={cx(styles.minor, m.major && styles.major)} d={m.d} />
        ))}
        {g.labels.map(l => (
          <text key={l.key} className={styles.axis} x={n(l.x)} y={n(l.y)} textAnchor={l.anchor}>
            {l.text}
          </text>
        ))}
        {g.now && <circle className={styles.now} cx={n(g.now.cx)} cy={n(g.now.cy)} r={4} />}
      </svg>
    </div>
  )
}
