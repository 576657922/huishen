import type { ReactNode, Ref } from 'react'
import { cx } from '../../cx'
import styles from './PageHead.module.css'

export interface PageHeadProps {
  title: ReactNode
  /** folio 左边：这一页装的是什么（「17 项练习」）；可以有一个数字用 <b> 标成次级墨色 */
  folioStart?: ReactNode
  /** folio 右边：一句限定（「时长为默认值」「只在这台设备上」） */
  folioEnd?: ReactNode
  /**
   * folio：手机，以及桌面的练习、依据页——标题下 12，1 px 墨线开头的一行小字；
   * subline：桌面记录页——标题下 4 的小字，右边是操作，16 之下一道 1 px 墨线
   */
  variant?: 'folio' | 'subline'
  subline?: ReactNode
  actions?: ReactNode
  /** 路由切换后焦点落在 h1 上（§11），所以 h1 可以被程序聚焦 */
  titleRef?: Ref<HTMLHeadingElement>
  id?: string
  className?: string
}

/** 页头（DESIGN.md §8.0、§5.5）：只有标题这一块，不含导航 */
export function PageHead({
  title,
  folioStart,
  folioEnd,
  variant = 'folio',
  subline,
  actions,
  titleRef,
  id,
  className,
}: PageHeadProps) {
  const h1 = (
    <h1 ref={titleRef} id={id} tabIndex={-1} className={styles.title}>
      {title}
    </h1>
  )
  if (variant === 'subline') {
    return (
      <header className={cx(styles.head, styles.subline, className)}>
        <div>
          {h1}
          {subline && <p className={styles.sub}>{subline}</p>}
        </div>
        {actions && <div className={styles.actions}>{actions}</div>}
      </header>
    )
  }
  return (
    <header className={cx(styles.head, className)}>
      {h1}
      {(folioStart || folioEnd) && (
        <p className={styles.folio}>
          <span>{folioStart}</span>
          <span>{folioEnd}</span>
        </p>
      )}
    </header>
  )
}
