import { useEffect, useRef } from 'react'
import { Outlet, ScrollRestoration, useLocation } from 'react-router'
import { ToastHost } from '@/ui'
import { UpdatePrompt } from '../pwa'
import { useThemeSync } from '../theme'
import { focusPageHeading } from './focus'
import { trackPath } from './history'
import { PreCheckinHost } from './PreCheckinHost'

/**
 * 换页（不含第一次打开）之后，焦点落到新页面的 h1 上；地址带 #id 时落到那个元素上。
 * 用地址的 key 认出第一次打开：开发时 StrictMode 会把 effect 多跑一遍，只靠「第几次运行」会在打开时就抢走焦点
 */
function useRouteFocus(): void {
  const location = useLocation()
  const initialKey = useRef(location.key)
  useEffect(() => {
    trackPath(location.pathname)
    if (location.key === initialKey.current) return
    focusPageHeading(location.hash)
  }, [location])
}

/**
 * 所有路由的根：外观跟着偏好走、换页后焦点到 h1、返回时恢复滚动位置（新页面从顶上开始），
 * 以及挂在根部的提示条、练习前自评和新版本提示
 */
export function RootLayout() {
  useThemeSync()
  useRouteFocus()
  return (
    <ToastHost>
      <ScrollRestoration />
      <Outlet />
      <PreCheckinHost />
      <UpdatePrompt />
    </ToastHost>
  )
}
