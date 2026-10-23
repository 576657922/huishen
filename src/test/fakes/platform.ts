/**
 * 假的平台端口：记录屏幕常亮和振动，前后台由测试切换。
 *
 * @example
 * const platform = new FakePlatform()
 * platform.setHidden(true)   // 通知监听者：页面进入后台
 * platform.awake             // 当前是否要求屏幕常亮
 * platform.vibrations        // [40, [30, 60, 30], ...]
 */
import type { PlatformPort } from '@/engine/types'

export interface FakePlatformOptions {
  /** 一开始是否在后台，默认否 */
  hidden?: boolean
}

export class FakePlatform implements PlatformPort {
  /** 当前是否要求屏幕常亮 */
  awake = false
  /** 每次 keepAwake 的参数，按顺序 */
  readonly awakeLog: boolean[] = []
  /** 每次振动的参数，按顺序 */
  readonly vibrations: Array<number | number[]> = []
  private isHidden: boolean
  private readonly listeners = new Set<() => void>()

  constructor(options: FakePlatformOptions = {}) {
    this.isHidden = options.hidden ?? false
  }

  keepAwake(on: boolean): void {
    this.awake = on
    this.awakeLog.push(on)
  }

  vibrate(pattern: number | number[]): void {
    this.vibrations.push(Array.isArray(pattern) ? [...pattern] : pattern)
  }

  hidden(): boolean {
    return this.isHidden
  }

  onVisibilityChange(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /** 切换前后台并通知监听者，和浏览器的 visibilitychange 一样 */
  setHidden(hidden: boolean): void {
    if (hidden === this.isHidden) return
    this.isHidden = hidden
    for (const l of [...this.listeners]) l()
  }

  /** 当前的前后台监听者数量，用来检查是否漏了取消订阅 */
  listenerCount(): number {
    return this.listeners.size
  }
}
