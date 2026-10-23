import { useId } from 'react'
import { cx } from '../../cx'
import { useRadioGroup } from '../../useRadioGroup'
import styles from './ScaleGroup.module.css'

export interface ScaleGroupProps {
  /** 0–10（两行：0–5、6–10）或 1–5（一行五格） */
  min: number
  max: number
  /**
   * 两端的说明：SUMMARY.checkin.low / .high（「一点也不」「非常紧张」），
   * 或已经带着数字的 RECORDS.weeklyStress.low / .high（「1 很小」「5 很大」）——数字只印一次
   */
  anchors: { low: string; high: string }
  /** 不预选：开始时为 null */
  value: number | null
  onChange: (value: number) => void
  label?: string
  labelledBy?: string
  className?: string
}

/** 「0 一点也不」：数字用 Inter，和说明之间不断行 */
function Anchor({ figure, text }: { figure: number; text: string }) {
  const lead = `${figure} `
  const rest = text.startsWith(lead) ? text.slice(lead.length) : text
  return (
    <>
      <span className="pnum">{figure}</span>
      {`\u00A0${rest}`}
    </>
  )
}

/**
 * 量表（DESIGN.md §8.16）：0–10 排成两行、同一 58 px 节距，每格 57 × 48；
 * 相邻格共用 1 px 线，外框四角圆 4；选中格墨色填充。说明只有一行：「0 一点也不 · 10 非常紧张」。
 * 方向键移动焦点（上下跨行），空格或回车才选：点一下就提交的题，不能让方向键替人选。
 */
export function ScaleGroup({
  min,
  max,
  anchors,
  value,
  onChange,
  label,
  labelledBy,
  className,
}: ScaleGroupProps) {
  const values = Array.from({ length: max - min + 1 }, (_, i) => min + i)
  const twoRows = values.length > 6
  const group = useRadioGroup({
    values,
    value,
    onChange,
    selectOnMove: false,
    columns: twoRows ? 6 : undefined,
  })
  const anchorsId = useId()
  return (
    <div className={className}>
      <div
        role="radiogroup"
        aria-label={labelledBy ? undefined : label}
        aria-labelledby={labelledBy}
        aria-describedby={anchorsId}
        className={cx(styles.scale, twoRows ? styles.two : styles.one)}
      >
        {values.map((v, i) => (
          // biome-ignore lint/a11y/useSemanticElements: 格子样式的单选按 APG radio group 用 button + role="radio"、漫游焦点实现
          <button
            key={v}
            ref={group.ref(i)}
            type="button"
            role="radio"
            aria-checked={v === value}
            tabIndex={group.tabIndex(i)}
            onKeyDown={group.onKeyDown(i)}
            onFocus={group.onFocus(i)}
            onClick={() => onChange(v)}
            className={styles.cell}
          >
            {v}
          </button>
        ))}
      </div>
      <p className={styles.anchors} id={anchorsId}>
        <Anchor figure={min} text={anchors.low} />
        {' · '}
        <Anchor figure={max} text={anchors.high} />
      </p>
    </div>
  )
}
