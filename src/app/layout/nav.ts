/**
 * 导航的各项和「当前在哪一项」（DESIGN.md §8.11、§8.12）。标签栏和导航栏共用这一份。
 */
import type { IconName } from '@/ui'
import { NAV } from '../strings'

export type NavKey = 'today' | 'practices' | 'records' | 'evidence' | 'help' | 'settings'

export interface NavItem {
  key: NavKey
  to: string
  label: string
  icon: IconName
  /** 当前项用实心的图标；求助方式和设置没有实心的 */
  iconOn: IconName
}

/** 四个主项：手机的标签栏和桌面、平板的导航栏都有 */
export const MAIN_NAV: readonly NavItem[] = [
  { key: 'today', to: '/', label: NAV.today, icon: 'today', iconOn: 'today-on' },
  { key: 'practices', to: '/practices', label: NAV.practices, icon: 'practice', iconOn: 'practice-on' },
  { key: 'records', to: '/records', label: NAV.records, icon: 'records', iconOn: 'records-on' },
  { key: 'evidence', to: '/evidence', label: NAV.evidence, icon: 'evidence', iconOn: 'evidence-on' },
]

/** 导航栏底部：求助方式、设置（手机上设置从今日的右上角进，求助方式从「现在有点难」进） */
export const FOOT_NAV: readonly NavItem[] = [
  { key: 'help', to: '/help', label: NAV.help, icon: 'help', iconOn: 'help' },
  { key: 'settings', to: '/settings', label: NAV.settings, icon: 'settings', iconOn: 'settings' },
]

const under = (path: string, base: string): boolean => path === base || path.startsWith(`${base}/`)

/**
 * 路由 → 导航栏的当前项（DESIGN.md §8.12）：计划、舒适节律探索都算在「练习」里
 */
export function railCurrent(pathname: string): NavKey | null {
  if (pathname === '/') return 'today'
  if (under(pathname, '/practices') || under(pathname, '/program') || under(pathname, '/pace-finder'))
    return 'practices'
  if (under(pathname, '/records')) return 'records'
  if (under(pathname, '/evidence')) return 'evidence'
  if (under(pathname, '/help')) return 'help'
  if (under(pathname, '/settings')) return 'settings'
  return null
}

/** 路由 → 手机标签栏的当前项：设置从今日进（返回键写着「‹ 今日」），求助方式不属于任何一项 */
export function tabCurrent(pathname: string): NavKey | null {
  const key = railCurrent(pathname)
  if (key === 'settings') return 'today'
  return key === 'help' ? null : key
}
