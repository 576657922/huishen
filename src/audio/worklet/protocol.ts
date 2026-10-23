/**
 * 限幅器 Worklet 与主线程共用的名字和消息。主线程不能直接导入 limiter.ts（那里会调用音频线程才有的 registerProcessor）
 */
export const LIMITER_PROCESSOR = 'huishen-limiter'

export type LimiterMessage =
  | { type: 'ready'; latency: number }
  | { type: 'stats'; compDb: number; limitDb: number }
