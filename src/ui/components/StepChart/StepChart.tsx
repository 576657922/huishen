import { TODAY } from '@/content/copy'
import { cx } from '../../cx'
import { type StepSection, stepChartGeometry, type TreadState } from '../../figures/stepchart'
import { n } from '../../figures/svg'
import { stepChartLabel } from '../../strings'
import { useFigureWidth } from '../../useFigureWidth'
import styles from './StepChart.module.css'

export interface StepChartProps {
  /** 铺满整段时长的各段（引擎时间线用 stepSections() 换算：补上「开始」，段间空隙算前一段） */
  sections: readonly StepSection[]
  /** 总秒数 */
  duration: number
  /** 练习中的秒数：分出过去、当前、将来，朱色的点标出现在 */
  now?: number | null
  /** 每级高：播放器 6，今日 5；0 就是 SectionStrip（所有踏步在一个高度） */
  step?: number
  /** up 从脚往上（身体扫描）；down 从头往下（睡前身体扫描） */
  direction?: 'up' | 'down'
  /** 时间轴（细线、每分钟一个刻度、「0」「5」「10 分钟」） */
  axis?: boolean
  /** 跳过的段的 id：虚线 */
  skipped?: readonly string[]
  /** 图的名字，读屏先听到它，再听到各段的开始时间：「身体扫描进度」 */
  name: string
  /** 不给时占满所在的栏 */
  width?: number
  className?: string
}

const TREAD: Record<TreadState, string | undefined> = {
  plain: undefined,
  past: styles.past,
  now: undefined,
  future: styles.future,
  skipped: styles.skipped,
}
const LABEL: Record<TreadState, string | undefined> = {
  plain: undefined,
  past: undefined,
  now: styles.labelNow,
  future: styles.labelFuture,
  skipped: styles.labelFuture,
}

/**
 * 段落图（DESIGN.md §8.15.7 StepChart）：身体扫描一段一级，从脚往上；全身就是最上面那一级。踏步 2 px；
 * 过去的次级墨色，当前的到现在为止是墨色、之后 1.25 px 线色，将来的 1.25 px 线色，跳过的是 2 / 4 的虚线；
 * 标签 11 px：过去次级墨色、当前墨色 600、将来三级墨色。现在是 8 px 的朱色点。
 */
export function StepChart({
  sections,
  duration,
  now = null,
  step = 6,
  direction = 'up',
  axis = true,
  skipped,
  name,
  width,
  className,
}: StepChartProps) {
  const [ref, w] = useFigureWidth<HTMLDivElement>(width, 350)
  const g = stepChartGeometry({
    sections,
    duration,
    width: w,
    step,
    direction,
    now,
    axis,
    skipped,
    endLabel: TODAY.minutes,
  })
  return (
    <div ref={ref} className={cx(styles.frame, className)}>
      <svg
        className={styles.chart}
        width={g.width}
        height={n(g.height)}
        viewBox={`0 0 ${g.width} ${n(g.height)}`}
        role="img"
        aria-label={stepChartLabel(name, sections)}
      >
        {g.treads.map(t => (
          <path key={t.key} className={cx(styles.tread, TREAD[t.state])} d={t.d} />
        ))}
        {g.labels.map(l => (
          <text key={l.key} className={cx(styles.label, LABEL[l.state])} x={n(l.x)} y={n(l.y)}>
            {l.text}
          </text>
        ))}
        {g.now && <circle className={styles.now} cx={n(g.now.cx)} cy={n(g.now.cy)} r={4} />}
        {g.axis && (
          <g>
            <path className={styles.base} d={g.axis.base} />
            {g.axis.ticks.map(t => (
              <path key={t.key} className={cx(styles.tick, t.major && styles.major)} d={t.d} />
            ))}
            {g.axis.labels.map(l => (
              <text key={l.key} className={styles.axis} x={n(l.x)} y={n(l.y)} textAnchor={l.anchor}>
                {l.text}
              </text>
            ))}
          </g>
        )}
      </svg>
    </div>
  )
}

export type SectionStripProps = Omit<StepChartProps, 'step' | 'direction'>

/** 其他引导练习的段落条（§8.15.7）：同一个图，所有踏步在一个高度 */
export function SectionStrip(props: SectionStripProps) {
  return <StepChart {...props} step={0} />
}
