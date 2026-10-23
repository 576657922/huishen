import { afterEach, describe, expect, it, vi } from 'vitest'
import { canWrite, getLocalStorage, readJSON, readText, removeKey, writeText } from './storage'

/** 每个方法都抛错，像禁用了站点数据的浏览器 */
function throwingStorage(): Storage {
  const fail = () => {
    throw new DOMException('denied', 'SecurityError')
  }
  return { length: 0, clear: fail, getItem: fail, key: fail, removeItem: fail, setItem: fail }
}

/** 读得到，写不进：旧版 Safari 隐私模式，或空间已满 */
function fullStorage(): Storage {
  const data = new Map<string, string>([['kept', '"old"']])
  return {
    get length() {
      return data.size
    },
    clear: () => data.clear(),
    getItem: key => data.get(key) ?? null,
    key: () => null,
    removeItem: key => {
      data.delete(key)
    },
    setItem: () => {
      throw new DOMException('full', 'QuotaExceededError')
    },
  }
}

afterEach(() => {
  localStorage.clear()
})

describe('getLocalStorage', () => {
  it('returns the page storage when it is reachable', () => {
    expect(getLocalStorage()).toBe(localStorage)
  })

  it('returns null when merely touching localStorage throws', () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('denied', 'SecurityError')
      },
    })
    try {
      expect(getLocalStorage()).toBeNull()
    } finally {
      if (original) Object.defineProperty(globalThis, 'localStorage', original)
      else Reflect.deleteProperty(globalThis, 'localStorage')
    }
    expect(getLocalStorage()).toBe(localStorage)
  })
})

describe('reading', () => {
  it('reads text and JSON', () => {
    localStorage.setItem('k', '{"a":1}')
    expect(readText(localStorage, 'k')).toBe('{"a":1}')
    expect(readJSON(localStorage, 'k')).toEqual({ a: 1 })
  })

  it('treats missing, corrupted and unreachable values as absent', () => {
    localStorage.setItem('bad', '{oops')
    expect(readText(localStorage, 'missing')).toBeNull()
    expect(readJSON(localStorage, 'missing')).toBeUndefined()
    expect(readJSON(localStorage, 'bad')).toBeUndefined()
    expect(readText(null, 'k')).toBeNull()
    expect(readJSON(null, 'k')).toBeUndefined()
    expect(readText(throwingStorage(), 'k')).toBeNull()
    expect(readJSON(throwingStorage(), 'k')).toBeUndefined()
  })

  it('keeps JSON null distinct from a missing key', () => {
    localStorage.setItem('nothing', 'null')
    expect(readJSON(localStorage, 'nothing')).toBeNull()
  })
})

describe('writing', () => {
  it('reports whether the value was really stored', () => {
    expect(writeText(localStorage, 'k', 'v')).toBe(true)
    expect(localStorage.getItem('k')).toBe('v')
    expect(writeText(null, 'k', 'v')).toBe(false)
    expect(writeText(throwingStorage(), 'k', 'v')).toBe(false)
    expect(writeText(fullStorage(), 'k', 'v')).toBe(false)
  })

  it('removes keys and never throws doing so', () => {
    localStorage.setItem('k', 'v')
    removeKey(localStorage, 'k')
    expect(localStorage.getItem('k')).toBeNull()
    expect(() => removeKey(null, 'k')).not.toThrow()
    expect(() => removeKey(throwingStorage(), 'k')).not.toThrow()
  })

  it('probes writability and cleans up after itself', () => {
    const write = vi.spyOn(Storage.prototype, 'setItem')
    expect(canWrite(localStorage)).toBe(true)
    expect(write).toHaveBeenCalledTimes(1)
    expect(localStorage.length).toBe(0)
    expect(canWrite(fullStorage())).toBe(false)
    expect(canWrite(throwingStorage())).toBe(false)
    expect(canWrite(null)).toBe(false)
  })
})
