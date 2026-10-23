/**
 * 浏览器里的平台能力：屏幕常亮（Screen Wake Lock）、振动、页面前后台。
 * 都是「有就用、没有也不影响练习」的能力，任何失败都静默忽略。
 */
import type { PlatformPort } from './types'

interface SentinelLike {
  release(): Promise<void>
  addEventListener(type: 'release', listener: () => void): void
}

/** 只用到的那部分 navigator，便于测试注入 */
export interface DeviceLike {
  wakeLock?: { request(type: 'screen'): Promise<SentinelLike> }
  vibrate?(pattern: number | number[]): boolean
}

/** 只用到的那部分 document */
export interface VisibilityLike {
  readonly hidden: boolean
  addEventListener(type: 'visibilitychange', listener: () => void): void
  removeEventListener(type: 'visibilitychange', listener: () => void): void
}

export interface BrowserPlatform extends PlatformPort {
  /** 释放屏幕常亮并移除监听；应用热重载或测试结束时用 */
  dispose(): void
}

export function createBrowserPlatform(
  doc: VisibilityLike = document,
  device: DeviceLike = navigator,
): BrowserPlatform {
  let wanted = false
  let sentinel: SentinelLike | null = null
  let requesting = false

  async function acquire(): Promise<void> {
    const lock = device.wakeLock
    // 页面在后台时申请必然被拒，等回到前台再申请
    if (!wanted || sentinel || requesting || !lock || doc.hidden) return
    requesting = true
    try {
      const s = await lock.request('screen')
      if (!wanted) {
        // 申请期间练习已经暂停或结束
        s.release().catch(() => undefined)
        return
      }
      sentinel = s
      // 页面进入后台时系统会自动释放
      s.addEventListener('release', () => {
        if (sentinel === s) sentinel = null
      })
    } catch {
      // 省电模式、权限策略都可能拒绝；屏幕会照常熄灭，练习不受影响
    } finally {
      requesting = false
    }
  }

  function release(): void {
    const s = sentinel
    sentinel = null
    s?.release().catch(() => undefined)
  }

  const onVisibility = (): void => {
    if (!doc.hidden && wanted) void acquire()
  }
  doc.addEventListener('visibilitychange', onVisibility)

  return {
    keepAwake(on) {
      wanted = on
      if (on) void acquire()
      else release()
    },
    vibrate(pattern) {
      try {
        // 必须以 navigator 为 this 调用
        if (typeof device.vibrate === 'function') device.vibrate(pattern)
      } catch {
        // 没有用户手势时部分浏览器会拒绝
      }
    },
    hidden: () => doc.hidden,
    onVisibilityChange(listener) {
      doc.addEventListener('visibilitychange', listener)
      return () => doc.removeEventListener('visibilitychange', listener)
    },
    dispose() {
      wanted = false
      release()
      doc.removeEventListener('visibilitychange', onVisibility)
    },
  }
}
