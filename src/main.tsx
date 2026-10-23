/**
 * 启动：先装好设计系统（令牌、基础样式、图标），开发时处理 ?seed / ?speed，
 * 在第一次渲染之前把外观写到 <html> 上（免得先闪一下浅色），接上练习的流程，再渲染路由。
 */
import '@/ui'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router/dom'
import { initFlows } from '@/app/flows'
import { createAppRouter } from '@/app/router'
import { applyTheme } from '@/app/theme'
import { prefsStore } from '@/data'

async function boot(): Promise<void> {
  // 只在开发构建里：生产构建中这一段连同 src/dev 一起被去掉
  if (import.meta.env.DEV) {
    const { applyDevParams } = await import('@/dev/seed')
    await applyDevParams()
  }
  applyTheme(prefsStore.getState().theme)
  initFlows()
  const router = createAppRouter()
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  )
}

void boot()
