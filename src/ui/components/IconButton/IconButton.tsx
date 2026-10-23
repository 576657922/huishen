import type { ButtonHTMLAttributes, Ref } from 'react'
import { cx } from '../../cx'
import type { IconName } from '../../icon-names'
import { Icon } from '../../icons'
import { AppLink } from '../../link'
import styles from './IconButton.module.css'

interface Common {
  icon: IconName
  /** 必填：只有图标的按钮靠它被读出来（DESIGN.md §8.3） */
  label: string
  className?: string
}

export type IconButtonProps = Common &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label' | 'children'> & { ref?: Ref<HTMLButtonElement> }

/** 44 × 44 的图标按钮，图标 24 墨色；悬停淡底、按下深一档；不可用时图标变成线色 */
export function IconButton({ icon, label, className, type = 'button', ...rest }: IconButtonProps) {
  return (
    <button {...rest} type={type} aria-label={label} className={cx(styles.btn, className)}>
      <Icon name={icon} size={24} />
    </button>
  )
}

export interface IconLinkProps extends Common {
  to: string
}

/** 外观同 IconButton、行为是链接：今日页右上角的「设置」 */
export function IconLink({ icon, label, className, to }: IconLinkProps) {
  return (
    <AppLink to={to} aria-label={label} className={cx(styles.btn, className)}>
      <Icon name={icon} size={24} />
    </AppLink>
  )
}
