import type { PacedParams } from '@/content/types'
import { describePattern } from '@/engine'
import { cx } from '../../cx'
import { specimenGeometry } from '../../figures/specimen'
import { n } from '../../figures/svg'
import { secondsText } from '../../strings'
import { useFigureWidth } from '../../useFigureWidth'
import styles from './BreathSpecimen.module.css'

export interface BreathSpecimenProps {
  /** 练习的默认节拍参数（practice.paced） */
  params: PacedParams
  /** 画几轮：慢呼吸 3，叹息和箱式呼吸 1 */
  cycles?: number
  /** 高 140（手机和桌面相同） */
  height?: number
  /** 读屏的整句；默认引擎的 describePattern：「吸 4.5 秒，呼 6.5 秒 · 每分钟 5.5 次」 */
  label?: string
  /** 不给时占满所在的栏 */
  width?: number
  className?: string
}

/**
 * 节律示意（DESIGN.md §8.9 BreathSpecimen，练习详情的图 1）：默认参数下几轮稳定的节律，秒为横轴——每秒一个刻度、
 * 每 5 秒一条网格、每 10 秒一个标签，单位在最后一个标签上；2 px 的线，下面不填色；第一轮上方的括号写出每一段。
 * 图注（「图 1」+ DETAIL.figureCaption）由 Figure 放在下面。
 */
export function BreathSpecimen({
  params,
  cycles = 3,
  height = 140,
  label,
  width,
  className,
}: BreathSpecimenProps) {
  const [ref, w] = useFigureWidth<HTMLDivElement>(width, 350)
  const g = specimenGeometry({ params, cycles, width: w, height, seconds: secondsText })
  return (
    <div ref={ref} className={cx(styles.frame, className)}>
      <svg
        className={styles.specimen}
        width={g.width}
        height={g.height}
        viewBox={`0 0 ${g.width} ${g.height}`}
        role="img"
        aria-label={label ?? describePattern(params)}
      >
        {g.grid.map(l => (
          <path key={l.key} className={styles.grid} d={l.d} />
        ))}
        {g.ticks.map(t => (
          <path key={t.key} className={cx(styles.tick, t.major && styles.major)} d={t.d} />
        ))}
        {g.axis.map(a => (
          <text key={a.key} className={styles.axis} x={n(a.x)} y={n(a.y)} textAnchor={a.anchor}>
            {a.text}
          </text>
        ))}
        <path className={styles.rule} d={g.rule} />
        <path className={styles.line} d={g.line} />
        {g.brackets.map(b => (
          <g key={b.key}>
            <path className={styles.bracket} d={b.d} />
            <text className={styles.note} x={n(b.x)} y={n(b.y)} textAnchor="middle">
              {b.text}
            </text>
          </g>
        ))}
      </svg>
    </div>
  )
}
