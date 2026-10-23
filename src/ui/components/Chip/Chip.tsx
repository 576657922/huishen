import type { ButtonHTMLAttributes } from 'react'
import { cx } from '../../cx'
import type { IconName } from '../../icon-names'
import { Icon } from '../../icons'
import styles from './Chip.module.css'

export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * default：有点急、跳过这一处（36 高，点按区域补到 44）；quiet：标签次级墨色；
   * unwell：播放器 HUD 里的「不舒服？」——看得见的 44 高、i-help 墨色，从不安静
   */
  variant?: 'default' | 'quiet' | 'unwell'
  icon?: IconName
}

/** 小标签按钮（DESIGN.md §8.15.3）：1 px 线框、圆角 4；按下深一档，不可用时标签变成线色 */
export function Chip({
  variant = 'default',
  icon,
  className,
  children,
  type = 'button',
  ...rest
}: ChipProps) {
  const name = icon ?? (variant === 'unwell' ? 'help' : undefined)
  return (
    <button
      {...rest}
      type={type}
      aria-haspopup={variant === 'unwell' ? 'dialog' : rest['aria-haspopup']}
      className={cx(
        styles.chip,
        variant === 'quiet' && styles.quiet,
        variant === 'unwell' && styles.unwell,
        className,
      )}
    >
      {name && <Icon name={name} size={18} className={styles.icon} />}
      {children}
    </button>
  )
}
