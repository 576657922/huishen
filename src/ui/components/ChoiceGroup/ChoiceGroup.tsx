import { cx } from '../../cx'
import { useRadioGroup } from '../../useRadioGroup'
import styles from './ChoiceGroup.module.css'

export interface ChoiceOption<T> {
  value: T
  label: string
}

export interface ChoiceGroupProps<T> {
  options: readonly ChoiceOption<T>[]
  /** 不预选：开始时为 null */
  value: T | null
  onChange: (value: T) => void
  label?: string
  labelledBy?: string
  className?: string
}

/**
 * 一次点选（DESIGN.md §8.16，练完感觉）：一组四个等宽格，48 高；点一下就提交，没有确认。
 * 方向键只移动焦点，空格或回车才选——经过「很不舒服」不会把它选上。
 * 选了更紧张、很不舒服也和别的选项一样是墨色填充，从不当作警告。
 */
export function ChoiceGroup<T>({
  options,
  value,
  onChange,
  label,
  labelledBy,
  className,
}: ChoiceGroupProps<T>) {
  const group = useRadioGroup({ values: options.map(o => o.value), value, onChange, selectOnMove: false })
  return (
    <div
      role="radiogroup"
      aria-label={labelledBy ? undefined : label}
      aria-labelledby={labelledBy}
      className={cx(styles.choice, className)}
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
          className={styles.cell}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
