/** 模块内部用的简单事件分发 */
export interface Emitter<T> {
  on(listener: (value: T) => void): () => void
  emit(value: T): void
  readonly size: number
}

export function createEmitter<T>(): Emitter<T> {
  const listeners = new Set<(value: T) => void>()
  return {
    on(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    emit(value) {
      // 遍历副本：回调里取消订阅不影响这一轮；一个回调出错不能让其他订阅者收不到
      for (const listener of [...listeners]) {
        try {
          listener(value)
        } catch (error) {
          queueMicrotask(() => {
            throw error
          })
        }
      }
    },
    get size() {
      return listeners.size
    },
  }
}
