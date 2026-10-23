import type { ReactNode } from 'react'
import { cx } from '../../cx'
import { useRadioGroup } from '../../useRadioGroup'
import styles from './Segmented.module.css'

export interface SegmentOption<T> {
  value: T
  /** 至多 4 个字或一个短数字 */
  label: ReactNode
  /** 第二行小字（「测量版」），选中时变成墨色上的次级色 */
  sub?: ReactNode
}

export interface SegmentedProps<T> {
  options: readonly SegmentOption<T>[]
  value: T
  onChange: (value: T) => void
  /** 组的名字：一般用 labelledBy 指向行标签；没有可见标签时给 label */
  label?: string
  labelledBy?: string
  describedBy?: string
  className?: string
}

/**
 * 分段控件（DESIGN.md §8.8）：线框里的等宽格，选中格是墨色填充、--on-ink 600——整套系统唯一的选中样式。
 * role="radiogroup"，漫游焦点，← → 移动并选中，Home / End 到两端；焦点框画在格子外面。
 */
export function Segmented<T>({
  options,
  value,
  onChange,
  label,
  labelledBy,
  describedBy,
  className,
}: SegmentedProps<T>) {
  const group = useRadioGroup({ values: options.map(o => o.value), value, onChange, selectOnMove: true })
  return (
    <div
      role="radiogroup"
      aria-label={labelledBy ? undefined : label}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      className={cx(styles.seg, className)}
    >
      {options.map((o, i) => (
        // biome-ignore lint/a11y/useSemanticElements: 格子样式的单选按 APG radio group 用 button + role="radio"、漫游焦点实现
        <button
          key={String(o.value)}
          ref={group.ref(i)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          tabIndex={group.tabIndex(i)}
          onKeyDown={group.onKeyDown(i)}
          onFocus={group.onFocus(i)}
          onClick={() => onChange(o.value)}
          className={cx(styles.cell, o.sub !== undefined && styles.twoLine)}
        >
          <span>{o.label}</span>
          {/* 空格让读屏把两行分开读（「15 测量版」）；在竖排的 flex 里它不占位置 */}
          {o.sub !== undefined && ' '}
          {o.sub !== undefined && <span className={styles.sub}>{o.sub}</span>}
        </button>
      ))}
    </div>
  )
}
