import { AppLink, Icon } from '@/ui'
import { NAV } from '../strings'
import { MAIN_NAV, type NavKey } from './nav'
import styles from './TabBar.module.css'

export interface TabBarProps {
  /** 当前项；不属于任何一项的页面（求助方式）为 null */
  current: NavKey | null
}

/**
 * 手机底部的标签栏（DESIGN.md §8.11）：今日、练习、记录、依据。当前项是实心图标和 600 字重，不只靠颜色。
 * 平板和桌面由导航栏代替；有停靠栏的页面、播放器、首次使用时不显示（看 <html data-bars>）
 */
export function TabBar({ current }: TabBarProps) {
  return (
    <nav className={styles.tabbar} aria-label={NAV.label}>
      {MAIN_NAV.map(item => {
        const on = item.key === current
        return (
          <AppLink key={item.key} to={item.to} className={styles.tab} aria-current={on ? 'page' : undefined}>
            <Icon name={on ? item.iconOn : item.icon} size={24} />
            <span>{item.label}</span>
          </AppLink>
        )
      })}
    </nav>
  )
}
