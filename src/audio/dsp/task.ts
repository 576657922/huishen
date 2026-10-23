/**
 * 可分片执行的生成任务。生成器每处理一小块就 yield 一次：
 * Worker 里一口气跑完；没有 Worker 时在主线程分片跑，每片不超过几毫秒，不卡界面。
 */

export type Task<T> = Generator<void, T, void>

export function runSync<T>(task: Task<T>): T {
  for (;;) {
    const r = task.next()
    if (r.done) return r.value
  }
}

/** 让出主线程：优先用 MessageChannel，比 setTimeout(0) 少了最短 4 毫秒的限制 */
function makeYield(): (cb: () => void) => void {
  if (typeof MessageChannel === 'undefined') return cb => setTimeout(cb, 0)
  const ch = new MessageChannel()
  const queue: (() => void)[] = []
  ch.port1.onmessage = () => queue.shift()?.()
  return cb => {
    queue.push(cb)
    ch.port2.postMessage(0)
  }
}

let yieldOnce: ((cb: () => void) => void) | null = null

/** 在主线程分片执行；每片约 budgetMs 毫秒，片与片之间把控制权交还给浏览器 */
export function runSliced<T>(task: Task<T>, budgetMs = 8): Promise<T> {
  yieldOnce ??= makeYield()
  const next = yieldOnce
  return new Promise((resolve, reject) => {
    const step = () => {
      const t0 = performance.now()
      try {
        for (;;) {
          const r = task.next()
          if (r.done) {
            resolve(r.value)
            return
          }
          if (performance.now() - t0 >= budgetMs) break
        }
      } catch (e) {
        reject(e)
        return
      }
      // 下一片放进新的宏任务，渲染和输入事件可以插进来
      next(step)
    }
    next(step)
  })
}
