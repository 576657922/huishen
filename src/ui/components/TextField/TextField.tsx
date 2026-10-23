import { type ChangeEvent, useId } from 'react'
import { cx } from '../../cx'
import { Icon } from '../../icons'
import { typeset } from '../../text'
import styles from './TextField.module.css'

export interface TextFieldProps {
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  /** 可见的标签（「备注」，17 号宋体）；标签在别处时用 labelledBy */
  label?: string
  labelledBy?: string
  placeholder?: string
  /** 备注最多 200 字；写到 180 起，下面右对齐显示「180/200」 */
  maxLength?: number
  /** 从这个字数起显示计数；默认 maxLength 的 90% */
  counterFrom?: number
  /** 错误信息：墨色 13 号，前面 i-info 16；框线变成 2 px 墨色（§3.5）。从不用红色 */
  error?: string
  /** 多行：随内容长高 */
  multiline?: boolean
  name?: string
  className?: string
}

/** 文本框（DESIGN.md §8.8）：至少 48 高，内边距 12，凸起纸色，1 px 线框；聚焦时 2 px 墨线，没有光晕 */
export function TextField({
  value,
  onChange,
  onBlur,
  label,
  labelledBy,
  placeholder,
  maxLength,
  counterFrom,
  error,
  multiline = false,
  name,
  className,
}: TextFieldProps) {
  const id = useId()
  const errorId = useId()
  const counterId = useId()
  const length = [...value].length
  const showCounter = maxLength !== undefined && length >= (counterFrom ?? Math.floor(maxLength * 0.9))
  const describedBy =
    [error ? errorId : null, showCounter ? counterId : null].filter(Boolean).join(' ') || undefined
  const common = {
    id,
    name,
    value,
    placeholder,
    maxLength,
    'aria-labelledby': label ? undefined : labelledBy,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': describedBy,
    className: cx(styles.field, error && styles.invalid),
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(e.target.value),
    onBlur,
  }
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className={styles.label}>
          {label}
        </label>
      )}
      {multiline ? <textarea {...common} rows={1} /> : <input {...common} type="text" />}
      {error && (
        <p className={styles.error} id={errorId}>
          <Icon name="info" size={16} />
          <span>{typeset(error)}</span>
        </p>
      )}
      {showCounter && (
        <p className={styles.counter} id={counterId}>
          <span className="tnum">{`${length}/${maxLength}`}</span>
        </p>
      )}
    </div>
  )
}
