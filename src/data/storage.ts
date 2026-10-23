/**
 * localStorage 的安全封装。禁用站点数据或部分隐私模式下，连读取 window.localStorage 属性本身都会抛错；
 * 空间满了写入也会抛错。这里一律吞掉异常，让调用方按「读不到」「没写进去」处理。
 */

export function getLocalStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

export function readText(storage: Storage | null, key: string): string | null {
  if (!storage) return null
  try {
    return storage.getItem(key)
  } catch {
    return null
  }
}

/** 解析失败或不存在时为 undefined */
export function readJSON(storage: Storage | null, key: string): unknown {
  const text = readText(storage, key)
  if (text === null) return undefined
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

/** 返回是否真的写进去了 */
export function writeText(storage: Storage | null, key: string, text: string): boolean {
  if (!storage) return false
  try {
    storage.setItem(key, text)
    return true
  } catch {
    return false
  }
}

export function removeKey(storage: Storage | null, key: string): void {
  if (!storage) return
  try {
    storage.removeItem(key)
  } catch {
    // 删不掉也不影响使用
  }
}

const PROBE_KEY = 'huishen.probe'

/** 试写一次：Safari 旧版隐私模式下 localStorage 存在但任何写入都会抛错 */
export function canWrite(storage: Storage | null): boolean {
  if (!writeText(storage, PROBE_KEY, '1')) return false
  removeKey(storage, PROBE_KEY)
  return true
}
