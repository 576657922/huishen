import { AppLink, Icon } from '@/ui'
import { NAV } from '../strings'
import { Lockup } from './Lockup'
import styles from './NavRail.module.css'
import { FOOT_NAV, MAIN_NAV, type NavItem, type NavKey } from './nav'

export interface NavRailProps {
  current: NavKey | null
}

function RailItem({ item, current }: { item: NavItem; current: NavKey | null }) {
  const on = item.key === current
  return (
    <AppLink to={item.to} className={styles.item} aria-current={on ? 'page' : undefined}>
      <Icon name={on ? item.iconOn : item.icon} size={24} />
      <span>{item.label}</span>
    </AppLink>
  )
}

/**
 * 平板（80，图标在字上）和桌面（240）左侧的导航栏（DESIGN.md §5.4、§5.5、§8.12）：
 * 标志 → 今日、练习、记录、依据 → 底部的求助方式、设置，桌面上最后一句「离线可用……」。手机上不显示
 */
export function NavRail({ current }: NavRailProps) {
  return (
    <nav className={styles.rail} aria-label={NAV.label}>
      <Lockup className={styles.lockup} />
      <div className={styles.list}>
        {MAIN_NAV.map(item => (
          <RailItem key={item.key} item={item} current={current} />
        ))}
      </div>
      <div className={styles.foot}>
        {FOOT_NAV.map(item => (
          <RailItem key={item.key} item={item} current={current} />
        ))}
        <p className={styles.note}>{NAV.railNote}</p>
      </div>
    </nav>
  )
}
