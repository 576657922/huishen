import { useSyncExternalStore } from 'react'
import type { SessionState } from '@/engine'
import { getController } from '../services'

const subscribe = (listener: () => void): (() => void) => getController().subscribe(listener)
const snapshot = (): SessionState => getController().getState()
const selectAll = (s: SessionState): SessionState => s

/**
 * 会话的粗粒度状态（倒数、进行、暂停、结束，字幕、段落、回神……），只在事件发生时重新渲染。
 * 逐帧的数值不要放在这里，用 useSessionClock。选择器请返回状态里已有的值，不要每次新建对象
 */
export function useSessionState(): SessionState
export function useSessionState<T>(selector: (s: SessionState) => T): T
export function useSessionState(selector: (s: SessionState) => unknown = selectAll): unknown {
  return useSyncExternalStore(
    subscribe,
    () => selector(snapshot()),
    () => selector(snapshot()),
  )
}
