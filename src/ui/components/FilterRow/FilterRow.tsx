import { cx } from '../../cx'
import { useRadioGroup } from '../../useRadioGroup'
import styles from './FilterRow.module.css'

export interface FilterOption<T> {
  value: T
  label: string
}

export interface FilterRowProps<T> {
  options: readonly FilterOption<T>[]
  value: T
  onChange: (value: T) => void
  label?: string
  labelledBy?: string
  /** 桌面依据页：竖排的单选行，当前项左边一道 2 px 墨线 */
  orientation?: 'horizontal' | 'vertical'
  className?: string
}

/**
 * 筛选（DESIGN.md §8.8）：不是分段控件，是一排文字。当前项墨色 600，底下一道 2 px 墨线；
 * 每个标签预留 600 字重的宽度，选中移动时整排不跳。单选组语义，焦点框向内收 2。
 */
export function FilterRow<T>({
  options,
  value,
  onChange,
  label,
  labelledBy,
  orientation = 'horizontal',
  className,
}: FilterRowProps<T>) {
  const group = useRadioGroup({ values: options.map(o => o.value), value, onChange, selectOnMove: true })
  return (
    <div
      role="radiogroup"
      aria-label={labelledBy ? undefined : label}
      aria-labelledby={labelledBy}
      aria-orientation={orientation}
      className={cx(styles.filter, orientation === 'vertical' && styles.vertical, className)}
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
          data-label={o.label}
          className={styles.option}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
