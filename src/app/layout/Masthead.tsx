import { dayKey, fmtDate } from '@/lib/date'
import { termLabel } from '@/lib/solar-terms'
import { IconLink } from '@/ui'
import { NAV } from '../strings'
import { Lockup } from './Lockup'
import styles from './Masthead.module.css'

/**
 * 今日的报头（DESIGN.md §8.0）：左边是标志（回到今日的链接），右边是设置。44 高。
 * 平板和桌面上不显示：导航栏顶上已经有标志，设置也在导航栏里
 */
export function Masthead() {
  return (
    <header className={styles.masthead}>
      <Lockup />
      <IconLink icon="settings" label={NAV.settings} to="/settings" />
    </header>
  )
}

/** 日期行（DESIGN.md §8.0）：上面 1 px 墨线、下面细线；左边「10月22日 星期四」，右边节气「霜降前一日」 */
export function Dateline({ date }: { date: Date }) {
  const term = termLabel(date)
  return (
    <p className={styles.dateline}>
      <time dateTime={dayKey(date)}>{fmtDate(date)}</time>
      {term && <span>{term}</span>}
    </p>
  )
}
