import { AppLink, cx } from '@/ui'
import { NAV } from '../strings'
import styles from './Lockup.module.css'

/** 印章「回」的轮廓（docs/design/final/mark.svg），填色跟随 currentColor，由样式给朱色 */
const SEAL_PATH =
  'M6 6H42V9.4H6ZM6 38.6H42V42H6ZM6 6H11.6V44.4H6ZM36.4 6H42V42H36.4ZM15.7 15H32.3V17.6H15.7ZM15.7 28.8H32.3V31.4H15.7ZM15.7 15H19.5V32.8H15.7ZM28.5 15H32.3V31.4H28.5Z'

/** 只有印章：标志、平板导航栏顶上 */
export function Seal({ className }: { className?: string }) {
  return (
    <svg className={cx(styles.seal, className)} viewBox="6 6 36 38.4" aria-hidden="true" focusable="false">
      <path fill="currentColor" d={SEAL_PATH} />
    </svg>
  )
}

export interface LockupProps {
  /** 链接时（今日的报头、导航栏）回到今日；首次使用页上不是链接 */
  link?: boolean
  /** large：首次使用页，印章 24、字 24 / 32（DESIGN.md §13.12） */
  size?: 'default' | 'large'
  className?: string
}

/** 标志：朱色印章 + 宋体「回神」（DESIGN.md §8.0） */
export function Lockup({ link = true, size = 'default', className }: LockupProps) {
  const cls = cx(styles.lockup, size === 'large' && styles.large, className)
  const inner = (
    <>
      <Seal />
      <span className={styles.wordmark} aria-hidden={link ? true : undefined}>
        {NAV.wordmark}
      </span>
    </>
  )
  if (!link) return <span className={cls}>{inner}</span>
  return (
    <AppLink to="/" className={cls} aria-label={NAV.lockup}>
      {inner}
    </AppLink>
  )
}
