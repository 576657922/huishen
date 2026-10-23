/**
 * 持久存储。默认情况下，空间紧张时浏览器可以清掉网站的数据；Safari 对没有添加到主屏幕的网站，
 * 一段时间不访问也会清掉。练习记录只存在本机，所以值得请浏览器保留。
 * Chrome 按使用情况静默决定，Firefox 会弹窗询问：应在用户存下第一条记录之后再请求，不要一打开就问。
 */

/** persisted：浏览器承诺保留；best-effort：空间紧张时可能被清掉；unsupported：浏览器不支持这个设置 */
export type Persistence = 'persisted' | 'best-effort' | 'unsupported'

/** 非安全上下文（http）里没有 navigator.storage；某些嵌入环境里访问它会抛错 */
function manager(): StorageManager | null {
  try {
    const storage: StorageManager | undefined =
      typeof navigator === 'undefined' ? undefined : navigator.storage
    return storage && typeof storage.persisted === 'function' ? storage : null
  } catch {
    return null
  }
}

/** 记录现在是否会被浏览器保留，给设置页显示 */
export async function persistence(): Promise<Persistence> {
  const storage = manager()
  if (!storage) return 'unsupported'
  try {
    return (await storage.persisted()) ? 'persisted' : 'best-effort'
  } catch {
    return 'unsupported'
  }
}

/** 请浏览器保留本站数据，返回请求之后的状态。被拒绝不算错误，记录照常保存 */
export async function requestPersistence(): Promise<Persistence> {
  const storage = manager()
  if (!storage || typeof storage.persist !== 'function') return 'unsupported'
  try {
    return (await storage.persist()) ? 'persisted' : 'best-effort'
  } catch {
    return 'best-effort'
  }
}
