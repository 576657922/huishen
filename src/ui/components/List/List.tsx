import { type ReactNode, useId, useState } from 'react'
import { cx } from '../../cx'
import { Icon } from '../../icons'
import { AppLink } from '../../link'
import { typeset } from '../../text'
import { Toggle } from '../Toggle/Toggle'
import styles from './List.module.css'

type HeadingLevel = 2 | 3 | 4

export interface ListGroupProps {
  /** 组标题（「外观」「数据」），13 号三级墨色，上 32 下 4；在页面结构里是一个标题 */
  title?: string
  /** 标题的级别：设置页的组是 h2（默认），小节里的组用 3 */
  level?: HeadingLevel
  children: ReactNode
  className?: string
}

/** 一组行：可选的组标题，下面一条细线开头的列表（DESIGN.md §8.7） */
export function ListGroup({ title, level = 2, children, className }: ListGroupProps) {
  const id = useId()
  if (!title) {
    return (
      <div className={className}>
        <div className={styles.list}>{children}</div>
      </div>
    )
  }
  return (
    // biome-ignore lint/a11y/useSemanticElements: 一组设置行不是表单字段组，fieldset 的语义和默认样式都不合适
    <div className={className} role="group" aria-labelledby={id}>
      <GroupTitle id={id} level={level}>
        {title}
      </GroupTitle>
      <div className={styles.list}>{children}</div>
    </div>
  )
}

export interface GroupTitleProps {
  children: ReactNode
  /** 默认 h3（小节里的「放松」「睡前」） */
  level?: HeadingLevel
  id?: string
  className?: string
}

/** 组标题：字号是说明文字，结构上是标题 */
export function GroupTitle({ children, level = 3, id, className }: GroupTitleProps) {
  const Tag = `h${level}` as const
  return (
    <Tag className={cx(styles.groupTitle, className)} id={id}>
      {children}
    </Tag>
  )
}

function Label({
  label,
  hint,
  labelId,
  hintId,
}: {
  label: ReactNode
  hint?: string
  labelId?: string
  hintId?: string
}) {
  return (
    <span className={styles.label}>
      <span id={labelId}>{label}</span>
      {hint && (
        <span className={styles.hint} id={hintId}>
          {typeset(hint)}
        </span>
      )}
    </span>
  )
}

export interface RowProps {
  label: ReactNode
  hint?: string
  /** 右边的值或操作：次级墨色的值，或一个 danger 按钮（危险操作只放按钮，从不做成整行） */
  end?: ReactNode
  className?: string
}

/** 静态的行：说明性的值（「版本 1.0.0」）或行尾带按钮 */
export function Row({ label, hint, end, className }: RowProps) {
  return (
    <div className={cx(styles.row, className)}>
      <Label label={label} hint={hint} />
      {end !== undefined && <span className={styles.value}>{end}</span>}
    </div>
  )
}

export interface NavRowProps {
  label: ReactNode
  hint?: string
  /** 当前值（「雨 + 长音」），次级墨色，箭头前 */
  value?: ReactNode
  to?: string
  onClick?: () => void
  /** 打开选择面板的行 */
  opensDialog?: boolean
  className?: string
}

/** 导航行：整行是链接（或打开面板的按钮），右边是值和 16 的箭头 */
export function NavRow({ label, hint, value, to, onClick, opensDialog, className }: NavRowProps) {
  const body = (
    <>
      <Label label={label} hint={hint} />
      <span className={styles.value}>
        {value}
        <Icon name="chevron-right" size={16} className={styles.chevron} />
      </span>
    </>
  )
  const cls = cx(styles.row, styles.interactive, className)
  if (to !== undefined) {
    return (
      <AppLink to={to} className={cls} aria-haspopup={opensDialog ? 'dialog' : undefined}>
        {body}
      </AppLink>
    )
  }
  return (
    <button
      type="button"
      className={cls}
      onClick={onClick}
      aria-haspopup={opensDialog ? 'dialog' : undefined}
    >
      {body}
    </button>
  )
}

export interface ToggleRowProps {
  label: ReactNode
  hint?: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  className?: string
}

/** 开关行：整行都能点；开关由行标签命名、由提示描述（§8.7、§8.8） */
export function ToggleRow({ label, hint, checked, onChange, disabled, className }: ToggleRowProps) {
  const labelId = useId()
  const hintId = useId()
  return (
    // 整行可点只是给指针的大目标；键盘和读屏用里面的开关（已在 Tab 顺序里），所以这里不加键盘处理
    // biome-ignore lint/a11y/useKeyWithClickEvents: 键盘操作由行内的 role="switch" 按钮承担
    // biome-ignore lint/a11y/noStaticElementInteractions: 同上，行本身不是控件
    <div
      className={cx(styles.row, !disabled && styles.interactive, className)}
      onClick={() => {
        if (!disabled) onChange(!checked)
      }}
    >
      <Label label={label} hint={hint} labelId={labelId} hintId={hint ? hintId : undefined} />
      <Toggle
        checked={checked}
        onChange={onChange}
        labelledBy={labelId}
        describedBy={hint ? hintId : undefined}
        disabled={disabled}
        onClick={e => e.stopPropagation()}
      />
    </div>
  )
}

export interface StackRowIds {
  labelId: string
  hintId?: string
}

export interface StackRowProps {
  label: ReactNode
  /** 只有滑块行在右边印当前值（「5.5 次/分」）；分段控件自己的选中格已经显示了 */
  value?: ReactNode
  hint?: ReactNode
  /** 下面的控件；传函数时拿到 labelId / hintId，交给控件的 labelledBy / describedBy */
  children: ReactNode | ((ids: StackRowIds) => ReactNode)
  className?: string
}

/** 上下排的行：标签在上，控件在 12 之下，提示再往下 8（§8.7） */
export function StackRow({ label, value, hint, children, className }: StackRowProps) {
  const labelId = useId()
  const hintId = useId()
  const ids: StackRowIds = { labelId, hintId: hint ? hintId : undefined }
  return (
    <div className={cx(styles.row, styles.stack, className)}>
      <div className={styles.top}>
        <span id={labelId}>{label}</span>
        {value !== undefined && <span className={styles.topValue}>{value}</span>}
      </div>
      <div className={styles.control}>{typeof children === 'function' ? children(ids) : children}</div>
      {hint && (
        <span className={styles.stackHint} id={hintId}>
          {typeof hint === 'string' ? typeset(hint) : hint}
        </span>
      )}
    </div>
  )
}

export interface DisclosureRowProps {
  label: ReactNode
  children: ReactNode
  defaultExpanded?: boolean
  className?: string
}

/** 展开行：标签和向下的箭头，展开后箭头转 180°，内容在 240 ms 里展开 */
export function DisclosureRow({ label, children, defaultExpanded = false, className }: DisclosureRowProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const panelId = useId()
  return (
    <div className={className}>
      <button
        type="button"
        className={cx(styles.row, styles.interactive)}
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={() => setExpanded(e => !e)}
      >
        <span className={styles.label}>{label}</span>
        <Icon name="chevron-down" size={16} className={styles.turn} />
      </button>
      <div className={styles.panel} id={panelId} data-expanded={expanded ? '' : undefined}>
        <div className={styles.panelInner} inert={!expanded}>
          {children}
        </div>
      </div>
    </div>
  )
}
