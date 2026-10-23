import type { AnchorHTMLAttributes, ButtonHTMLAttributes, MouseEvent, ReactNode, Ref } from 'react'
import { cx } from '../../cx'
import type { IconName } from '../../icon-names'
import { Icon } from '../../icons'
import { AppLink } from '../../link'
import styles from './Button.module.css'

export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger'

interface BaseProps {
  /** primary 墨色填充 · secondary 1 px 线框 · quiet 只有文字 · danger 墨色线框加垃圾桶（从不用红色） */
  variant?: ButtonVariant
  /** md 48 高；sm 36 高（点按区域仍是 44） */
  size?: 'md' | 'sm'
  block?: boolean
  /** danger 默认带 trash，其余默认没有图标 */
  icon?: IconName
  children: ReactNode
}

export type ButtonProps = BaseProps &
  ButtonHTMLAttributes<HTMLButtonElement> & { as?: 'button'; ref?: Ref<HTMLButtonElement> }

export type ButtonLinkProps = BaseProps & AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }

/** DESIGN.md §12.3 的写法 <Button as="a" to="…">，等同 ButtonLink */
export type ButtonAsLinkProps = ButtonLinkProps & { as: 'a' }

function iconSize(variant: ButtonVariant, size: 'md' | 'sm') {
  if (size === 'sm') return 16
  return variant === 'quiet' ? 18 : 20
}

function classes(variant: ButtonVariant, size: 'md' | 'sm', block: boolean, className?: string) {
  return cx(styles.btn, styles[variant], size === 'sm' && styles.small, block && styles.block, className)
}

function Inner({ variant, size, icon, children }: Required<Pick<BaseProps, 'variant' | 'size'>> & BaseProps) {
  const name = icon ?? (variant === 'danger' ? 'trash' : undefined)
  return (
    <>
      {name && <Icon name={name} size={iconSize(variant, size)} />}
      {children}
    </>
  )
}

/**
 * 按钮（DESIGN.md §8.3）。按下只换底色（100 ms），不缩放、没有波纹；没有转圈的加载态。
 * 「不可用但仍可聚焦」用 aria-disabled（如「我已读完」读到底之前），点击被忽略，焦点不丢。
 */
export function Button(props: ButtonProps | ButtonAsLinkProps) {
  if (props.as === 'a') {
    const { as: _as, ...link } = props
    return <ButtonLink {...link} />
  }
  return <NativeButton {...props} />
}

function NativeButton({
  variant = 'secondary',
  size = 'md',
  block = false,
  icon,
  children,
  className,
  type = 'button',
  onClick,
  as: _as,
  ...rest
}: ButtonProps) {
  const softDisabled = rest['aria-disabled'] === true || rest['aria-disabled'] === 'true'
  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    if (softDisabled) {
      e.preventDefault()
      return
    }
    onClick?.(e)
  }
  return (
    <button {...rest} type={type} className={classes(variant, size, block, className)} onClick={handleClick}>
      <Inner variant={variant} size={size} icon={icon}>
        {children}
      </Inner>
    </button>
  )
}

/** 外观是按钮、行为是链接（「去练习 ›」之外需要按钮外观的导航） */
export function ButtonLink({
  variant = 'secondary',
  size = 'md',
  block = false,
  icon,
  children,
  className,
  to,
  ...rest
}: ButtonLinkProps) {
  return (
    <AppLink {...rest} to={to} className={classes(variant, size, block, className)}>
      <Inner variant={variant} size={size} icon={icon}>
        {children}
      </Inner>
    </AppLink>
  )
}
