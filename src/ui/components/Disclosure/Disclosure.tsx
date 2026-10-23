import type { ReactNode } from 'react'
import { cx } from '../../cx'
import { Icon } from '../../icons'
import styles from './Disclosure.module.css'

export interface DisclosureProps {
  expanded: boolean
  /** 被展开的区域的 id */
  controls: string
  onToggle: () => void
  children: ReactNode
  /** 读屏名称比可见文字多一点时用（「展开：慢呼吸 · 心率变异性」） */
  label?: string
  className?: string
}

/** 展开按钮（DESIGN.md §8.19）：次级墨色的字加 16 的向下箭头，44 高；展开后箭头在 240 ms 里转 180° */
export function Disclosure({ expanded, controls, onToggle, children, label, className }: DisclosureProps) {
  return (
    <button
      type="button"
      aria-expanded={expanded}
      aria-controls={controls}
      aria-label={label}
      onClick={onToggle}
      className={cx(styles.disclose, className)}
    >
      {children}
      <Icon name="chevron-down" size={16} className={styles.icon} />
    </button>
  )
}

export interface RevealProps {
  id: string
  expanded: boolean
  children: ReactNode
  className?: string
}

/** 被展开的区域：grid-template-rows 0fr → 1fr，240 ms；收起时里面的内容不可聚焦 */
export function Reveal({ id, expanded, children, className }: RevealProps) {
  return (
    <div id={id} className={cx(styles.reveal, className)} data-expanded={expanded ? '' : undefined}>
      <div className={styles.inner} inert={!expanded}>
        {children}
      </div>
    </div>
  )
}
