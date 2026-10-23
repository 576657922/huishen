import type { ReactNode } from 'react'
import { cx } from '../../cx'
import { typeset } from '../../text'
import styles from './Kicker.module.css'

export interface KickerProps {
  /** 左边：「八周正念 · 第 3 周第 2 天」；计划名可以用 <b> 标成次级墨色 600 */
  start: ReactNode
  /** 右边：一般是带「证据」的等级 */
  end?: ReactNode
  /** 欢迎回来那一句用次级墨色（§13.2） */
  tone?: 'meta' | 'note'
  className?: string
}

/** 标题上方的一行小字（DESIGN.md §8.1）：13 号三级墨色，两端对齐 */
export function Kicker({ start, end, tone = 'meta', className }: KickerProps) {
  return (
    <p className={cx(styles.kicker, className)}>
      <span className={tone === 'note' ? styles.note : undefined}>{start}</span>
      {end}
    </p>
  )
}

export interface LeadProps {
  children: ReactNode
  className?: string
}

/** 标题下的第一段：17 / 28 次级墨色。纯文字时绑住数字和单位、最后四个字（§4.3） */
export function Lead({ children, className }: LeadProps) {
  return (
    <p className={cx(styles.lead, className)}>
      {typeof children === 'string' ? typeset(children) : children}
    </p>
  )
}

export interface UnitProps {
  children: ReactNode
  className?: string
}

/** 大数字后面的单位：13 号次级墨色，与数字隔 3 px，落在同一基线（§4.5） */
export function Unit({ children, className }: UnitProps) {
  return <span className={cx(styles.unit, className)}>{children}</span>
}
