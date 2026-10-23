import type { MouseEvent } from 'react'
import { cx } from '../../cx'
import styles from './Toggle.module.css'

export interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  /** 由行标签命名（DESIGN.md §8.8）；单独使用时给 label */
  labelledBy?: string
  label?: string
  describedBy?: string
  disabled?: boolean
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void
  className?: string
}

/** 开关：51 × 31，关是凹底加 1 px 线，开是墨色填充；role="switch"。总放在至少 52 高的行里，行就是点按目标 */
export function Toggle({
  checked,
  onChange,
  labelledBy,
  label,
  describedBy,
  disabled,
  onClick,
  className,
}: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      aria-label={labelledBy ? undefined : label}
      aria-describedby={describedBy}
      disabled={disabled}
      className={cx(styles.toggle, className)}
      onClick={e => {
        onClick?.(e)
        onChange(!checked)
      }}
    />
  )
}
