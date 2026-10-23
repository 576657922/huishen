import { type ReactNode, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { cx } from '../../cx'
import { useModalLayer, usePresence } from '../../layer'
import { typeset } from '../../text'
import { Button } from '../Button/Button'
import styles from './Dialog.module.css'

export interface DialogProps {
  open: boolean
  /** Esc 和点遮罩：等同取消 */
  onClose: () => void
  title: ReactNode
  /** 一两句话，说清会发生什么（「删除后无法恢复。」） */
  body?: ReactNode
  /** 右对齐的操作，间隔 12：先「取消」，再动词 */
  actions: ReactNode
  /** alertdialog：确认类对话框（删除、结束），打开时焦点落在不具破坏性的那个按钮上 */
  role?: 'dialog' | 'alertdialog'
  className?: string
  surface?: 'app' | 'player'
}

/**
 * 对话框（DESIGN.md §8.13）：最宽 400（手机上屏宽减 40），内边距 24，圆角 14，凸起纸色，浮起的阴影，遮罩。
 * 只用于少数几处：播放器里的结束、删除一条记录、删除全部数据（两步）、不限时睡前声音、重新开始计划。
 */
export function Dialog({
  open,
  onClose,
  title,
  body,
  actions,
  role = 'dialog',
  className,
  surface = 'app',
}: DialogProps) {
  const layerRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const actionsRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const bodyId = useId()
  const presence = usePresence(open, panelRef)
  // 焦点先到第一个操作（「取消」）：误按回车也不会删掉东西。在打开后的布局阶段才去找它
  const firstAction = useRef({
    get current(): HTMLElement | null {
      return actionsRef.current?.querySelector<HTMLElement>('button, a[href]') ?? null
    },
  }).current
  useModalLayer(layerRef, presence === 'open', { initialFocus: firstAction, onEscape: onClose })
  if (presence === 'closed' || typeof document === 'undefined') return null
  return createPortal(
    <div
      ref={layerRef}
      className={styles.layer}
      data-state={presence}
      data-theme={surface === 'player' ? 'dark' : undefined}
      data-surface={surface === 'player' ? 'player' : undefined}
    >
      <div className={styles.scrim} aria-hidden="true" onClick={presence === 'open' ? onClose : undefined} />
      {/* biome-ignore lint/a11y/useAriaPropsSupportedByRole: role 只会是 dialog 或 alertdialog，两者都支持 aria-modal */}
      <div
        ref={panelRef}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={body ? bodyId : undefined}
        className={cx(styles.dialog, className)}
      >
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        {body && (
          <div id={bodyId} className={styles.body}>
            {typeof body === 'string' ? typeset(body) : body}
          </div>
        )}
        <div ref={actionsRef} className={styles.actions}>
          {actions}
        </div>
      </div>
    </div>,
    document.body,
  )
}

export interface ConfirmDialogProps {
  surface?: 'app' | 'player'
  open: boolean
  title: ReactNode
  body?: ReactNode
  /** 动词：「删除」「结束」「继续」 */
  confirmLabel: string
  /** 「取消」，或结束对话框里的「继续练习」 */
  cancelLabel: string
  /** danger：确认按钮是墨色线框加垃圾桶（从不用红色）；default：确认按钮是主按钮 */
  tone?: 'default' | 'danger'
  onConfirm: () => void
  onCancel: () => void
}

/** 确认对话框：「取消」（次要）在前，动词在后 */
export function ConfirmDialog({
  surface,
  open,
  title,
  body,
  confirmLabel,
  cancelLabel,
  tone = 'default',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog
      surface={surface}
      open={open}
      onClose={onCancel}
      title={title}
      body={body}
      role="alertdialog"
      actions={
        <>
          <Button variant="secondary" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    />
  )
}
