/**
 * 新版本提示（DESIGN.md §8.13、§13.14）：Service Worker 发现新版本时，安静地提示「有新版本」和「更新」。
 * 从不在练习中弹出（倒数、进行、暂停都不行），小结开着时也等它关掉；一次打开只提示一次，不催。
 * 更新由用户点了才做（vite.config.ts 里 registerType: 'prompt'），练习不会被自动刷新打断。
 */

import { useRegisterSW } from 'virtual:pwa-register/react'
import { useEffect, useRef } from 'react'
import { useToast } from '@/ui'
import { usePendingSession } from './flows/store'
import { useSessionState } from './hooks/useSessionState'
import { SYSTEM } from './strings'

export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(error: unknown) {
      console.error(error)
    },
  })
  const phase = usePendingSession(s => s.phase)
  const status = useSessionState(s => s.status)
  const toast = useToast()
  const shown = useRef(false)
  const quiet = phase === 'idle' && (status === 'idle' || status === 'done')

  useEffect(() => {
    if (!needRefresh || !quiet || shown.current) return
    shown.current = true
    toast.show({
      message: SYSTEM.update.message,
      action: { label: SYSTEM.update.action, onAction: () => void updateServiceWorker(true) },
    })
  }, [needRefresh, quiet, toast, updateServiceWorker])

  return null
}
