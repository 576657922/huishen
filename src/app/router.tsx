/**
 * 路由（PRODUCT.md §1）。页面都从 src/features/<feature>/index.tsx 懒加载，只取约定好的具名导出（docs/APP.md）。
 * 外框：标签页和推入的页面在 AppFrame 里（手机标签栏、平板和桌面导航栏）；/welcome 只有正文；
 * /play/:id 是全屏的播放器（练完在同一个地址显示小结）。
 */
import { createBrowserRouter, type RouteObject, redirect } from 'react-router'
import { prefsStore } from '@/data'
import { AppFrame } from './layout/AppFrame'
import { PlayerRoute } from './layout/PlayerRoute'
import { RootLayout } from './layout/RootLayout'
import { setNavigate } from './navigation'
import { ErrorPage } from './pages/ErrorPage'
import { NotFound } from './pages/NotFound'

/** 第一次打开、还没看过「首次使用」时，今日先去 /welcome */
const welcomeFirst = (): Response | null => (prefsStore.getState().onboarded ? null : redirect('/welcome'))

export const routes: RouteObject[] = [
  {
    element: <RootLayout />,
    errorElement: (
      <AppFrame nav={false}>
        <ErrorPage />
      </AppFrame>
    ),
    children: [
      {
        element: <AppFrame />,
        children: [
          {
            errorElement: <ErrorPage />,
            children: [
              {
                index: true,
                loader: welcomeFirst,
                lazy: async () => ({ Component: (await import('@/features/today')).TodayPage }),
              },
              {
                path: 'practices',
                lazy: async () => ({ Component: (await import('@/features/practices')).CataloguePage }),
              },
              // 舒适节律探索有自己的地址；目录里的链接按练习 id 拼出来，也送过去
              { path: 'practices/pace-finder', loader: () => redirect('/pace-finder') },
              {
                path: 'practices/listen',
                lazy: async () => ({ Component: (await import('@/features/sound')).SoundDetailPage }),
              },
              {
                path: 'practices/sleep',
                lazy: async () => ({ Component: (await import('@/features/sound')).SoundDetailPage }),
              },
              {
                path: 'practices/:id',
                lazy: async () => ({ Component: (await import('@/features/practices')).PracticeDetailPage }),
              },
              {
                path: 'records',
                lazy: async () => ({ Component: (await import('@/features/records')).RecordsPage }),
              },
              {
                path: 'evidence',
                lazy: async () => ({ Component: (await import('@/features/evidence')).EvidencePage }),
              },
              {
                path: 'settings/*',
                lazy: async () => ({ Component: (await import('@/features/settings')).SettingsPage }),
              },
              {
                path: 'program/:id',
                lazy: async () => ({ Component: (await import('@/features/program')).ProgramPage }),
              },
              {
                path: 'pace-finder',
                lazy: async () => ({ Component: (await import('@/features/pace-finder')).PaceFinderPage }),
              },
              {
                path: 'help',
                lazy: async () => ({ Component: (await import('@/features/help')).HelpPage }),
              },
              { path: '*', element: <NotFound /> },
            ],
          },
        ],
      },
      {
        path: 'welcome',
        element: <AppFrame nav={false} />,
        errorElement: (
          <AppFrame nav={false}>
            <ErrorPage />
          </AppFrame>
        ),
        children: [
          {
            index: true,
            lazy: async () => ({ Component: (await import('@/features/onboarding')).WelcomePage }),
          },
        ],
      },
      {
        path: 'play/:id',
        element: <PlayerRoute />,
        errorElement: (
          <AppFrame>
            <ErrorPage />
          </AppFrame>
        ),
      },
    ],
  },
]

/** 建好路由，并把它的 navigate 交给不在组件里的流程（startPractice 等） */
export function createAppRouter(): ReturnType<typeof createBrowserRouter> {
  const router = createBrowserRouter(routes)
  setNavigate((to, options) => {
    void router.navigate(to, options)
  })
  return router
}
