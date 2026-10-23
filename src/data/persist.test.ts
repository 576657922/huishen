import { afterEach, describe, expect, it, vi } from 'vitest'
import { persistence, requestPersistence } from './persist'

/** jsdom 没有 navigator.storage：装一个假的，测完拿掉 */
function fakeStorage(manager: Partial<StorageManager> | (() => never)): void {
  const descriptor: PropertyDescriptor =
    typeof manager === 'function'
      ? { configurable: true, get: manager }
      : { configurable: true, value: manager }
  Object.defineProperty(navigator, 'storage', descriptor)
}

afterEach(() => {
  Reflect.deleteProperty(navigator, 'storage')
})

describe('persistent storage', () => {
  it('reports unsupported where the browser has no storage manager (http, old browsers)', async () => {
    expect(await persistence()).toBe('unsupported')
    expect(await requestPersistence()).toBe('unsupported')
  })

  it('reads the current state', async () => {
    fakeStorage({ persisted: async () => true })
    expect(await persistence()).toBe('persisted')
    fakeStorage({ persisted: async () => false })
    expect(await persistence()).toBe('best-effort')
  })

  it('asks the browser to keep the records and reports the answer', async () => {
    const persist = vi.fn(async () => true)
    fakeStorage({ persisted: async () => false, persist })
    expect(await requestPersistence()).toBe('persisted')
    expect(persist).toHaveBeenCalledTimes(1)
    fakeStorage({ persisted: async () => false, persist: async () => false })
    expect(await requestPersistence()).toBe('best-effort')
  })

  it('never throws, even when the browser does', async () => {
    fakeStorage({
      persisted: () => Promise.reject(new DOMException('denied', 'SecurityError')),
      persist: () => Promise.reject(new DOMException('denied', 'SecurityError')),
    })
    expect(await persistence()).toBe('unsupported')
    expect(await requestPersistence()).toBe('best-effort')
    fakeStorage(() => {
      throw new Error('sandboxed')
    })
    expect(await persistence()).toBe('unsupported')
    expect(await requestPersistence()).toBe('unsupported')
  })

  it('treats a manager without persist() as unsupported for requests', async () => {
    fakeStorage({ persisted: async () => false })
    expect(await requestPersistence()).toBe('unsupported')
  })
})
