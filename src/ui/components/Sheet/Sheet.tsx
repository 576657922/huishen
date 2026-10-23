import { type CSSProperties, type PointerEvent, type ReactNode, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cx } from '../../cx'
import { useModalLayer, usePresence } from '../../layer'
import { UI } from '../../strings'
import { IconButton } from '../IconButton/IconButton'
import styles from './Sheet.module.css'

export interface SheetProps {
  open: boolean
  /** Esc、点遮罩、向下拖、点关闭都走这里；不可关的面板不会调用它 */
  onClose: () => void
  title: ReactNode
  children: ReactNode
  /** 固定在底部、不随内容滚走的操作区（顶上一条细线） */
  footer?: ReactNode
  /** 必须作出选择的面板（开始之前、舒适节律的评分）：没有拖动条，Esc 和遮罩都不关 */
  dismissible?: boolean
  /** 右上角的关闭按钮（「关闭」） */
  closeButton?: boolean
  /** 标题右边的一个小操作，如「跳过」（安静按钮） */
  headAction?: ReactNode
  /** player：播放器里打开的面板——深色、从顶部 112 起；桌面上是右侧 420 的面板 */
  surface?: 'app' | 'player'
  /** full：占满可用高度（开始之前；播放器里的面板） */
  size?: 'auto' | 'full'
  /** 平板和桌面上做成 560 宽的对话框，而不是 480（开始之前，DESIGN.md §13.12）；播放器里的面板不受影响 */
  wide?: boolean
  className?: string
}

/** 拖过面板高度的 30%，或松手时速度超过 0.5 px/ms，就关闭（DESIGN.md §8.13） */
const DRAG_RATIO = 0.3
const DRAG_SPEED = 0.5

/**
 * 底部面板（DESIGN.md §8.13）：手机上从底部升起，平板和桌面上变成居中的 480 对话框；
 * 播放器里的面板在平板上仍是底部面板（最宽 560），桌面上是右侧 420 的整高面板。
 * 打开时焦点到标题，Tab 困在面板里，背景 inert 且不滚动，关闭后焦点回到触发它的元素。
 * 正文先滚动，标题和底部操作从不滚走（200% 文字时也一样）。
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
  dismissible = true,
  closeButton = false,
  headAction,
  surface = 'app',
  size = 'auto',
  wide = false,
  className,
}: SheetProps) {
  const layerRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const titleId = useId()
  const presence = usePresence(open, panelRef)
  const [drag, setDrag] = useState<number | null>(null)
  const dragStart = useRef<{ y: number; t: number } | null>(null)
  // 重新打开时，上次拖关留下的位移归零
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setDrag(null)
  }

  useModalLayer(layerRef, presence === 'open', {
    initialFocus: titleRef,
    onEscape: dismissible ? onClose : undefined,
  })

  if (presence === 'closed' || typeof document === 'undefined') return null

  const onGrabDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!dismissible || e.button !== 0) return
    e.currentTarget.setPointerCapture?.(e.pointerId)
    dragStart.current = { y: e.clientY, t: e.timeStamp }
    setDrag(0)
  }
  const onGrabMove = (e: PointerEvent<HTMLDivElement>) => {
    const s = dragStart.current
    if (!s) return
    setDrag(Math.max(0, e.clientY - s.y))
  }
  const onGrabUp = (e: PointerEvent<HTMLDivElement>) => {
    const s = dragStart.current
    dragStart.current = null
    if (!s) return
    const dy = Math.max(0, e.clientY - s.y)
    const height = panelRef.current?.getBoundingClientRect().height ?? Number.POSITIVE_INFINITY
    const speed = dy / Math.max(1, e.timeStamp - s.t)
    if (dy > height * DRAG_RATIO || speed > DRAG_SPEED) {
      onClose()
      return
    }
    setDrag(null)
  }

  const player = surface === 'player'
  // 拖动时面板跟着手指；关掉时退场动画从当前位置接着往下走
  const dragStyle = drag === null ? undefined : ({ '--drag': `${drag}px` } as CSSProperties)

  return createPortal(
    <div
      ref={layerRef}
      className={cx(styles.layer, player && styles.player)}
      data-state={presence}
      data-theme={player ? 'dark' : undefined}
      data-surface={player ? 'player' : undefined}
    >
      <div
        className={styles.scrim}
        aria-hidden="true"
        onClick={dismissible && presence === 'open' ? onClose : undefined}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cx(styles.sheet, size === 'full' && styles.full, wide && styles.wide, className)}
        data-dragging={drag !== null ? '' : undefined}
        style={dragStyle}
      >
        {dismissible && (
          <div
            className={styles.grab}
            aria-hidden="true"
            onPointerDown={onGrabDown}
            onPointerMove={onGrabMove}
            onPointerUp={onGrabUp}
            onPointerCancel={() => {
              dragStart.current = null
              setDrag(null)
            }}
          >
            <span className={styles.grabber} />
          </div>
        )}
        <div className={styles.head}>
          <h2 id={titleId} ref={titleRef} tabIndex={-1} className={styles.title}>
            {title}
          </h2>
          {(headAction || closeButton) && (
            <div className={styles.headEnd}>
              {headAction}
              {closeButton && <IconButton icon="close" label={UI.close} onClick={onClose} />}
            </div>
          )}
        </div>
        <div className={styles.body}>{children}</div>
        {footer && <div className={styles.foot}>{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}
