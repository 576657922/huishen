import { lazy, Suspense, useEffect } from 'react'
import { useParams } from 'react-router'
import { isCatalogPracticeId, isOffered, PRACTICE_BY_ID } from '@/content/practices'
import { abandonPractice } from '../flows/finish'
import { usePendingSession } from '../flows/store'
import { currentPath } from '../navigation'
import { NotFound } from '../pages/NotFound'
import { AppFrame } from './AppFrame'
import { focusPageHeading } from './focus'
import { PlayerFrame } from './PlayerFrame'
import styles from './PlayerRoute.module.css'

const PlayerPage = lazy(() => import('@/features/player').then(m => ({ default: m.PlayerPage })))
const SummaryPage = lazy(() => import('@/features/player').then(m => ({ default: m.SummaryPage })))

/**
 * /play/:id：练习中是全屏、深色、没有导航的播放器；练完以后在同一个地址显示小结，回到应用的主题
 * （手机上没有标签栏，桌面上有导航栏）。离开这个地址时，还在进行的练习就此结束（满 1 分钟照样记下）。
 * 直接打开或刷新这个地址时没有进行中的练习，播放器页面给一个「开始」（必须由用户点按，声音才能出来）
 */
export function PlayerRoute() {
  const { id = '' } = useParams()
  const phase = usePendingSession(s => s.phase)
  const active = usePendingSession(s => s.start?.practiceId ?? null)

  useEffect(
    () => () => {
      // 开发时 StrictMode 会假装卸载一次：地址还在播放器上时什么也不做
      if (!currentPath().startsWith('/play/')) abandonPractice()
    },
    [],
  )
  useEffect(() => {
    if (phase === 'summary') focusPageHeading()
  }, [phase])

  if (phase === 'summary') {
    return (
      <AppFrame>
        <div className={styles.leave} data-theme="dark" aria-hidden="true" />
        <Suspense fallback={null}>
          <SummaryPage />
        </Suspense>
      </AppFrame>
    )
  }
  // 深链接、刷新：只认目录里、v1 提供的练习（isOffered 对不认识的 id、正念行走、睡前身体扫描都为 false），其余 404
  const practiceId = active ?? (isCatalogPracticeId(id) && isOffered(id) ? id : null)
  if (!practiceId) {
    return (
      <AppFrame>
        <NotFound />
      </AppFrame>
    )
  }
  return (
    <PlayerFrame name={PRACTICE_BY_ID[practiceId].name}>
      <Suspense fallback={null}>
        <PlayerPage practiceId={practiceId} />
      </Suspense>
    </PlayerFrame>
  )
}
