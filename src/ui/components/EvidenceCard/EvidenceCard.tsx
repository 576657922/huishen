import { type ReactNode, useId } from 'react'
import type { Grade } from '@/content/types'
import { cx } from '../../cx'
import { type Effect, signed } from '../../figures/plots'
import { UI } from '../../strings'
import { typeset } from '../../text'
import { Disclosure, Reveal } from '../Disclosure/Disclosure'
import { GradeMark } from '../GradeMark/GradeMark'
import styles from './EvidenceCard.module.css'

export interface EvidenceField {
  /** 栏名：EVIDENCE.card.design 等 */
  term: ReactNode
  content: ReactNode
  /** 效应量这一栏：栏名独占一行，内容占满整宽 */
  wide?: boolean
}

export interface EvidenceCardProps {
  /** 左上：「呼吸练习 · 压力」 */
  topic: string
  grade: Grade | null
  /**
   * 一句带比较对象的结论。字符串在这里排版（数字绑单位、最后一行至少四个字，§4.3）；
   * 传节点（例如带引文编号）时，调用方自己用 keep() 绑好最后几个字
   */
  claim: ReactNode
  /** 收起时的一行：只写研究类型和规模（「元分析 · 223 项研究」） */
  meta?: ReactNode
  /** 第 3–8 栏，顺序按 PRODUCT.md §9：效应量 → 研究类型 → 等级 → 局限 → 相反证据 → DOI */
  fields: readonly EvidenceField[]
  /** 给了 onToggle 就是可收起的卡片：结论下面一行 meta 和「展开」 */
  expanded?: boolean
  onToggle?: () => void
  id?: string
  className?: string
}

/**
 * 证据卡片（DESIGN.md §8.10）：顶上 1 px 墨线；kicker、结论、各栏。没有「可信度」一栏——
 * 等级词（强 · 中等 · 有限 · 不足）是证据页唯一的评级用语。
 */
export function EvidenceCard({
  topic,
  grade,
  claim,
  meta,
  fields,
  expanded = true,
  onToggle,
  id,
  className,
}: EvidenceCardProps) {
  const claimId = useId()
  const fieldsId = useId()
  const collapsible = onToggle !== undefined
  const list = (
    <dl className={styles.fields}>
      {fields.map((f, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: 各栏顺序固定（PRODUCT.md §9），不会增删重排
        <div key={i} className={cx(styles.field, f.wide && styles.wide)}>
          <dt>{f.term}</dt>
          <dd>{typeof f.content === 'string' ? typeset(f.content) : f.content}</dd>
        </div>
      ))}
    </dl>
  )
  return (
    <article
      id={id}
      className={cx(styles.card, collapsible && styles.closed, className)}
      aria-labelledby={claimId}
    >
      <p className={styles.kicker}>
        <span>{topic}</span>
        <GradeMark grade={grade} prefix />
      </p>
      <p id={claimId} className={styles.claim}>
        {typeof claim === 'string' ? typeset(claim) : claim}
      </p>
      {collapsible ? (
        <>
          <p className={styles.meta}>
            <span>{meta}</span>
            <Disclosure
              expanded={expanded}
              controls={fieldsId}
              onToggle={onToggle}
              label={`${expanded ? UI.collapse : UI.expand}：${topic}`}
            >
              {expanded ? UI.collapse : UI.expand}
            </Disclosure>
          </p>
          <Reveal id={fieldsId} expanded={expanded}>
            {list}
          </Reveal>
        </>
      ) : (
        list
      )}
    </article>
  )
}

export interface Outcome {
  /** 结果名：「压力」 */
  name: string
  /** 「12 项试验 · 785 人」，三级墨色 */
  detail?: string
  /** 印在右边的数字：「g = −0.35（−0.55 至 −0.14）」，或没有区间时的统计量「ηp² < 0.001，p = 0.765」 */
  value: string
  /** 有 95% 置信区间才画一行；没有就不画——从不画编出来的区间 */
  ci?: Effect
}

export interface EffectRowsProps {
  outcomes: readonly Outcome[]
  /** 一张卡片共用一根轴 */
  domain: readonly [number, number]
  ticks: readonly number[]
  /** 轴下的说明：「小于 0 表示比对照减轻。……」 */
  note?: string
}

/** 效应量与 95% CI：每个结果一行文字，下面 16 高的区间——零处一条细线、2 px 区间、8 px 估计点 */
export function EffectRows({ outcomes, domain, ticks, note }: EffectRowsProps) {
  // 横坐标用百分比，区间在任何栏宽下都清晰（左右各留 5 px，由 CSS 的边距给出）
  const pct = (v: number) => `${((v - domain[0]) / (domain[1] - domain[0])) * 100}%`
  return (
    <div className={styles.es}>
      {outcomes.map(o => (
        <div key={o.name}>
          <div className={styles.esRow}>
            <span className={styles.esName}>
              {o.name}
              {o.detail && <span className={styles.esDetail}>{o.detail}</span>}
            </span>
            <span className={styles.esValue}>{o.value}</span>
          </div>
          {o.ci && (
            <svg className={styles.ci} height={16} aria-hidden="true" focusable="false">
              <line className={styles.zero} x1={pct(0)} x2={pct(0)} y1={0} y2={16} />
              <line className={styles.range} x1={pct(o.ci.lo)} x2={pct(o.ci.hi)} y1={8} y2={8} />
              <circle className={styles.est} cx={pct(o.ci.g)} cy={8} r={4} />
            </svg>
          )}
        </div>
      ))}
      <svg className={styles.axis} height={20} aria-hidden="true" focusable="false">
        <line className={styles.axisLine} x1="0%" x2="100%" y1={0.5} y2={0.5} />
        {ticks.map(t => (
          <g key={t}>
            <line className={styles.axisLine} x1={pct(t)} x2={pct(t)} y1={0.5} y2={4.5} />
            <text className={styles.axisLabel} x={pct(t)} y={17} textAnchor="middle">
              {t === 0 ? '0' : signed(t)}
            </text>
          </g>
        ))}
      </svg>
      {note && <p className={styles.esNote}>{typeset(note)}</p>}
    </div>
  )
}
