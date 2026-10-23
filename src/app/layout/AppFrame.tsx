import type { MouseEvent, ReactNode } from 'react'
import { Outlet, useLocation } from 'react-router'
import { NAV } from '../strings'
import styles from './AppFrame.module.css'
import { focusPageHeading } from './focus'
import { NavRail } from './NavRail'
import { railCurrent, tabCurrent } from './nav'
import { TabBar } from './TabBar'

export interface AppFrameProps {
  /** 不给时渲染路由的 <Outlet /> */
  children?: ReactNode
  /** false：只有正文，没有导航（首次使用） */
  nav?: boolean
}

/** 「跳到正文」：焦点直接落到这一页的 h1 */
function skipToContent(e: MouseEvent<HTMLAnchorElement>): void {
  e.preventDefault()
  focusPageHeading()
}

/**
 * 应用的外框（DESIGN.md §5.2、§13.1）：手机是正文 + 底部标签栏；平板是 80 宽的导航栏 + 正文；
 * 桌面是 240 宽的导航栏 + 正文（最宽 1104，靠左）。<main> 在这里，页面自己不要再写 main
 */
export function AppFrame({ children, nav = true }: AppFrameProps) {
  const { pathname } = useLocation()
  const content = children ?? <Outlet />
  if (!nav) {
    return (
      <main id="main" className={styles.main}>
        {content}
      </main>
    )
  }
  return (
    <div className={styles.app}>
      {/* biome-ignore lint/a11y/useValidAnchor: 跳到正文按惯例是链接（不靠脚本也能用）；点击时只把焦点交给 h1，地址不变 */}
      <a className={styles.skip} href="#main" onClick={skipToContent}>
        {NAV.skip}
      </a>
      <NavRail current={railCurrent(pathname)} />
      <main id="main" className={styles.main}>
        {content}
      </main>
      <TabBar current={tabCurrent(pathname)} />
    </div>
  )
}
