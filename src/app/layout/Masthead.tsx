import { dayKey, fmtDate } from '@/lib/date'
import { termLabel } from '@/lib/solar-terms'
import { IconLink } from '@/ui'
import { NAV } from '../strings'
import { Lockup } from './Lockup'
import styles from './Masthead.module.css'

/**
 * 今日的报头（DESIGN.md §8.0）：左边是标志（回到今日的链接），右边是设置。44 高。
 * 平板和桌面只显示页面传入的操作：标志、设置已在侧栏里
 */
export function Masthead({ actions }: { actions?: import('react').ReactNode }) {
  return (
    <header className={styles.masthead}>
      <Lockup />
      <div className={styles.actions}>
        {actions}
        <IconLink icon="settings" label={NAV.settings} to="/settings" />
      </div>
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
