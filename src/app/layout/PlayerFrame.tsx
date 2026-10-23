import { type ReactNode, useLayoutEffect } from 'react'
import { playerName } from '../strings'
import { setPlayerOpen } from '../theme'
import { useDocumentBars, useDocumentTitle } from './document'
import styles from './PlayerFrame.module.css'

export interface PlayerFrameProps {
  /** 练习名：读屏的地标名称是「慢呼吸练习」，浏览器标签上是「慢呼吸 · 回神」，练习中不变 */
  name: string
  /**
   * 播放器的四块，依次是 HUD、舞台、读数、控件，各自带 data-region="hud" | "stage" | "readouts" | "controls"：
   * 外框按它们排版（横着拿手机时舞台在左，其余在右；平板和桌面是居中的 640 一栏）
   */
  children: ReactNode
  /**
   * 放在应用外框（AppFrame）的正文里时为 true（舒适节律探索在自己的页面上跑每一档）：
   * 不再是 <main>（外框已经有一个），导航照样收起，播放器照样占满窗口
   */
  embedded?: boolean
}

/**
 * 播放器的外框（DESIGN.md §8.15.1、§8.15.18）：占满屏幕，总是深色（data-theme="dark" data-surface="player"），
 * 没有导航（<html data-bars="player"> 收起标签栏和导航栏），四周留出安全区。
 * 进入时底色从应用的主题在 900 ms 里过渡到深色；浏览器顶栏也变深
 */
export function PlayerFrame({ name, children, embedded = false }: PlayerFrameProps) {
  useDocumentBars('player')
  useDocumentTitle(name)
  useLayoutEffect(() => {
    setPlayerOpen(true)
    return () => setPlayerOpen(false)
  }, [])
  const Root = embedded ? 'section' : 'main'
  return (
    <Root className={styles.player} data-theme="dark" data-surface="player" aria-label={playerName(name)}>
      {children}
    </Root>
  )
}
