import {
  createContext,
  type ReactNode,
  type RefObject,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { usePresence } from '../../layer'
import { typeset } from '../../text'
import styles from './Toast.module.css'

export interface ToastAction {
  label: string
  onAction: () => void
}

export interface ToastInput {
  /** 一句平实的话：「已删除这条记录。」 */
  message: string
  /** 「撤销」「再试一次」「更新」 */
  action?: ToastAction
  /**
   * player：在播放器里弹出（「声音没能开始」+ 再试一次）——提示条跟播放器一样是深色。
   * 不给时看 <html data-bars>：播放器开着就是 player，否则跟随应用的外观
   */
  surface?: 'app' | 'player'
}

export interface ToastApi {
  /** 同一时间只有一条，新的替换旧的 */
  show: (toast: ToastInput) => void
  hide: () => void
}

/** 显示 4 秒，带操作的 6 秒；指针停在上面或焦点在里面时暂停计时（DESIGN.md §8.13） */
const SHOW_MS = 4000
const SHOW_WITH_ACTION_MS = 6000

const ToastContext = createContext<ToastApi | null>(null)

export function useToast(): ToastApi {
  const api = useContext(ToastContext)
  if (!api) throw new Error('useToast 要在 <ToastHost> 里面使用')
  return api
}

interface Current extends ToastInput {
  key: number
  surface: 'app' | 'player'
}

/** PlayerFrame 打开时在 <html> 上设 data-bars="player"（DESIGN.md §11） */
const surfaceNow = (): 'app' | 'player' =>
  typeof document !== 'undefined' && document.documentElement.dataset.bars === 'player' ? 'player' : 'app'

/**
 * 提示条的宿主：放在应用根部一次。提示条挂在 body 下自己的一层里（data-layer="toast"），
 * 面板和对话框打开时它不会被设成 inert，「撤销」仍然能点。
 * role="status" 的区域一直在，内容变化时读屏用 polite 读出——这是播放器之外唯一的实时区域。
 */
export function ToastHost({ children }: { children?: ReactNode }) {
  const [current, setCurrent] = useState<Current | null>(null)
  const [shown, setShown] = useState<Current | null>(null)
  const counter = useRef(0)
  const show = useCallback((toast: ToastInput) => {
    counter.current += 1
    setCurrent({ ...toast, key: counter.current, surface: toast.surface ?? surfaceNow() })
  }, [])
  const hide = useCallback(() => setCurrent(null), [])
  const api = useMemo(() => ({ show, hide }), [show, hide])

  // 退场动画期间还要显示刚才那一条
  if (current && current !== shown) setShown(current)
  const panelRef = useRef<HTMLDivElement>(null)
  const presence = usePresence(current !== null, panelRef)

  return (
    <ToastContext value={api}>
      {children}
      {typeof document !== 'undefined' &&
        createPortal(
          <div className={styles.region} data-layer="toast">
            <div role="status" aria-live="polite" aria-atomic="true">
              {presence !== 'closed' && shown && (
                <ToastView key={shown.key} toast={shown} state={presence} onDone={hide} panelRef={panelRef} />
              )}
            </div>
          </div>,
          document.body,
        )}
    </ToastContext>
  )
}

interface ToastViewProps {
  toast: Current
  state: 'open' | 'closing' | 'closed'
  onDone: () => void
  panelRef: RefObject<HTMLDivElement | null>
}

function ToastView({ toast, state, onDone, panelRef }: ToastViewProps) {
  const total = toast.action ? SHOW_WITH_ACTION_MS : SHOW_MS
  const remaining = useRef(total)
  const startedAt = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hovered = useRef(false)
  const focused = useRef(false)

  const pause = useCallback(() => {
    if (timer.current === null) return
    clearTimeout(timer.current)
    timer.current = null
    remaining.current -= Date.now() - startedAt.current
  }, [])
  const resume = useCallback(() => {
    if (timer.current !== null || hovered.current || focused.current) return
    startedAt.current = Date.now()
    timer.current = setTimeout(onDone, Math.max(0, remaining.current))
  }, [onDone])

  useEffect(() => {
    if (state !== 'open') return
    resume()
    return pause
  }, [state, resume, pause])

  return (
    // 指针停留和焦点进入只用来暂停计时，不是给人操作的控件
    // biome-ignore lint/a11y/noStaticElementInteractions: 同上
    <div
      ref={panelRef}
      className={styles.toast}
      data-state={state}
      // 播放器总是深色（§3.6）：提示条在 body 下，不在 PlayerFrame 里，要自己带上深色和播放器表面
      data-theme={toast.surface === 'player' ? 'dark' : undefined}
      data-surface={toast.surface === 'player' ? 'player' : undefined}
      onPointerEnter={() => {
        hovered.current = true
        pause()
      }}
      onPointerLeave={() => {
        hovered.current = false
        resume()
      }}
      onFocus={() => {
        focused.current = true
        pause()
      }}
      onBlur={() => {
        focused.current = false
        resume()
      }}
    >
      <span className={styles.message}>{typeset(toast.message)}</span>
      {toast.action && (
        <button
          type="button"
          className={styles.action}
          onClick={() => {
            toast.action?.onAction()
            onDone()
          }}
        >
          {toast.action.label}
        </button>
      )}
    </div>
  )
}
