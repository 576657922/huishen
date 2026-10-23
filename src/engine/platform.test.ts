import { describe, expect, it, vi } from 'vitest'
import { createBrowserPlatform, type DeviceLike, type VisibilityLike } from './platform'

/** 可以切换前后台的 document */
class FakeDocument implements VisibilityLike {
  hidden: boolean
  private readonly listeners = new Set<() => void>()

  constructor(hidden = false) {
    this.hidden = hidden
  }

  addEventListener(_type: 'visibilitychange', listener: () => void): void {
    this.listeners.add(listener)
  }

  removeEventListener(_type: 'visibilitychange', listener: () => void): void {
    this.listeners.delete(listener)
  }

  setHidden(hidden: boolean): void {
    this.hidden = hidden
    for (const l of [...this.listeners]) l()
  }

  listenerCount(): number {
    return this.listeners.size
  }
}

/** 屏幕常亮的凭据；系统在页面进入后台时会自己释放 */
class FakeSentinel {
  released = false
  readonly release = vi.fn(async () => {
    this.released = true
  })
  private readonly listeners = new Set<() => void>()

  addEventListener(_type: 'release', listener: () => void): void {
    this.listeners.add(listener)
  }

  releaseBySystem(): void {
    this.released = true
    for (const l of this.listeners) l()
  }
}

/** 可以手动决定每次申请何时、以什么结果返回的 Wake Lock */
function fakeWakeLock() {
  const sentinels: FakeSentinel[] = []
  const settle: Array<(ok: boolean) => void> = []
  const request = vi.fn(
    (_type: 'screen') =>
      new Promise<FakeSentinel>((resolve, reject) => {
        settle.push(ok => {
          if (!ok) return reject(new DOMException('拒绝', 'NotAllowedError'))
          const s = new FakeSentinel()
          sentinels.push(s)
          resolve(s)
        })
      }),
  )
  return {
    request,
    sentinels,
    /** 让最早一次还没返回的申请返回 */
    async answer(ok = true): Promise<void> {
      settle.shift()?.(ok)
      await flush()
    },
  }
}

const flush = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0))

function setup(options: { hidden?: boolean; device?: DeviceLike } = {}) {
  const doc = new FakeDocument(options.hidden)
  const lock = fakeWakeLock()
  const device: DeviceLike = options.device ?? { wakeLock: lock }
  return { doc, lock, platform: createBrowserPlatform(doc, device) }
}

describe('screen wake lock', () => {
  it('holds the lock while asked to and releases it after', async () => {
    const { lock, platform } = setup()
    platform.keepAwake(true)
    platform.keepAwake(true)
    expect(lock.request).toHaveBeenCalledTimes(1)
    expect(lock.request).toHaveBeenCalledWith('screen')
    await lock.answer()
    platform.keepAwake(true)
    expect(lock.request).toHaveBeenCalledTimes(1)
    platform.keepAwake(false)
    expect(lock.sentinels[0]?.release).toHaveBeenCalledTimes(1)
    platform.keepAwake(false)
    expect(lock.sentinels[0]?.release).toHaveBeenCalledTimes(1)
  })

  it('waits for the page to come to the front before asking', async () => {
    const { doc, lock, platform } = setup({ hidden: true })
    platform.keepAwake(true)
    expect(lock.request).not.toHaveBeenCalled()
    doc.setHidden(false)
    expect(lock.request).toHaveBeenCalledTimes(1)
  })

  it('asks again after the system released the lock in the background', async () => {
    const { doc, lock, platform } = setup()
    platform.keepAwake(true)
    await lock.answer()
    doc.setHidden(true)
    lock.sentinels[0]?.releaseBySystem()
    expect(lock.request).toHaveBeenCalledTimes(1)
    doc.setHidden(false)
    expect(lock.request).toHaveBeenCalledTimes(2)
    await lock.answer()
    platform.keepAwake(false)
    expect(lock.sentinels[1]?.release).toHaveBeenCalledTimes(1)
  })

  it('does not ask again on return when the lock is no longer wanted', async () => {
    const { doc, lock, platform } = setup()
    platform.keepAwake(true)
    await lock.answer()
    platform.keepAwake(false)
    doc.setHidden(true)
    doc.setHidden(false)
    expect(lock.request).toHaveBeenCalledTimes(1)
  })

  it('releases a lock that arrives after it stopped being wanted', async () => {
    const { lock, platform } = setup()
    platform.keepAwake(true)
    platform.keepAwake(false)
    await lock.answer()
    expect(lock.sentinels[0]?.release).toHaveBeenCalledTimes(1)
    // 申请期间又想要了：那次申请的结果直接用上
    platform.keepAwake(true)
    platform.keepAwake(false)
    platform.keepAwake(true)
    await lock.answer()
    expect(lock.request).toHaveBeenCalledTimes(2)
    expect(lock.sentinels[1]?.release).not.toHaveBeenCalled()
  })

  it('shrugs off refusals and tries again next time', async () => {
    const { lock, platform } = setup()
    platform.keepAwake(true)
    await lock.answer(false)
    platform.keepAwake(true)
    expect(lock.request).toHaveBeenCalledTimes(2)
  })

  it('ignores a failing release', async () => {
    const { lock, platform } = setup()
    platform.keepAwake(true)
    await lock.answer()
    lock.sentinels[0]?.release.mockRejectedValueOnce(new Error('已释放'))
    platform.keepAwake(false)
    await flush()
  })

  it('does nothing without wake lock support', () => {
    const { platform } = setup({ device: {} })
    expect(() => platform.keepAwake(true)).not.toThrow()
    expect(() => platform.keepAwake(false)).not.toThrow()
  })

  it('stops everything on dispose', async () => {
    const { doc, lock, platform } = setup()
    platform.keepAwake(true)
    await lock.answer()
    platform.dispose()
    expect(lock.sentinels[0]?.release).toHaveBeenCalledTimes(1)
    expect(doc.listenerCount()).toBe(0)
    doc.setHidden(true)
    doc.setHidden(false)
    expect(lock.request).toHaveBeenCalledTimes(1)
  })
})

describe('vibration', () => {
  it('calls the device with itself as this', () => {
    const device = {
      calls: [] as Array<number | number[]>,
      vibrate(this: { calls: Array<number | number[]> }, pattern: number | number[]): boolean {
        this.calls.push(pattern)
        return true
      },
    }
    const platform = createBrowserPlatform(new FakeDocument(), device)
    platform.vibrate(40)
    platform.vibrate([30, 60, 30])
    expect(device.calls).toEqual([40, [30, 60, 30]])
  })

  it('swallows refusals and missing support', () => {
    const throwing = createBrowserPlatform(new FakeDocument(), {
      vibrate: () => {
        throw new Error('没有用户手势')
      },
    })
    expect(() => throwing.vibrate(40)).not.toThrow()
    expect(() => createBrowserPlatform(new FakeDocument(), {}).vibrate(40)).not.toThrow()
  })
})

describe('visibility', () => {
  it('reports the page state and notifies until unsubscribed', () => {
    const { doc, platform } = setup()
    const listener = vi.fn()
    expect(platform.hidden()).toBe(false)
    const off = platform.onVisibilityChange(listener)
    doc.setHidden(true)
    expect(platform.hidden()).toBe(true)
    expect(listener).toHaveBeenCalledTimes(1)
    off()
    doc.setHidden(false)
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('works with the real document and navigator', () => {
    const platform = createBrowserPlatform()
    expect(platform.hidden()).toBe(document.hidden)
    expect(() => platform.vibrate(10)).not.toThrow()
    expect(() => platform.keepAwake(true)).not.toThrow()
    platform.dispose()
  })
})
