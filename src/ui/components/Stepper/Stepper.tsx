import { type MouseEvent, useEffect, useId, useRef } from 'react'
import { cx } from '../../cx'
import { Icon } from '../../icons'
import { UI } from '../../strings'
import styles from './Stepper.module.css'

export interface StepperProps {
  /** 离散的取值（静坐计时：1 · 3 · 5 · 10 · 15 · 20 · 30 · 45 · 60）；不给时用 min / max / step */
  values?: readonly number[]
  min?: number
  max?: number
  step?: number
  value: number
  onChange: (value: number) => void
  /** 中间的数字，Inter 等宽 */
  format?: (value: number) => string
  label?: string
  labelledBy?: string
  className?: string
}

/** 按住 400 ms 后每 150 ms 重复一次（DESIGN.md §8.8） */
const HOLD_DELAY_MS = 400
const REPEAT_MS = 150

/**
 * 步进器：[−] 数值 [+]，44 高、1 px 线框。到头的那一端变成线色并不可用——
 * 用 aria-disabled 而不是 disabled，正在按着它的键盘焦点不会因为到头而丢掉。
 */
export function Stepper({
  values,
  min = 0,
  max = 10,
  step = 1,
  value,
  onChange,
  format = v => String(v),
  label,
  labelledBy,
  className,
}: StepperProps) {
  const outputId = useId()
  const list = values ?? []
  const next = (v: number, dir: 1 | -1): number => {
    if (values) {
      const i = list.indexOf(v)
      const j = i < 0 ? (dir > 0 ? list.findIndex(x => x > v) : list.findLastIndex(x => x < v)) : i + dir
      return list[Math.min(list.length - 1, Math.max(0, j))] ?? v
    }
    const places = (String(step).split('.')[1] ?? '').length
    return Number(Math.min(max, Math.max(min, v + dir * step)).toFixed(places))
  }
  const lo = values ? (list[0] ?? value) : min
  const hi = values ? (list[list.length - 1] ?? value) : max
  const atMin = value <= lo
  const atMax = value >= hi

  // 按住重复时要拿到最新的值和回调，不能用闭包里旧的那一份
  const latest = useRef({ value, onChange, next })
  latest.current = { value, onChange, next }
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stopRepeat = () => {
    if (timer.current !== null) clearTimeout(timer.current)
    timer.current = null
  }
  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current)
    },
    [],
  )

  const bump = (dir: 1 | -1): boolean => {
    const { value: v, onChange: change, next: nx } = latest.current
    const to = nx(v, dir)
    if (to === v) return false
    latest.current.value = to
    change(to)
    return true
  }
  const startHold = (dir: 1 | -1) => {
    if (!bump(dir)) return
    const repeat = () => {
      if (bump(dir)) timer.current = setTimeout(repeat, REPEAT_MS)
      else stopRepeat()
    }
    timer.current = setTimeout(repeat, HOLD_DELAY_MS)
  }
  // 指针按下时已经走了一步；随后的 click（detail > 0）不再重复。键盘触发的 click 的 detail 是 0
  const onClick = (dir: 1 | -1) => (e: MouseEvent<HTMLButtonElement>) => {
    if (e.detail === 0) bump(dir)
  }

  const button = (dir: 1 | -1, disabled: boolean) => (
    <button
      type="button"
      aria-label={dir < 0 ? UI.decrease : UI.increase}
      aria-describedby={outputId}
      aria-disabled={disabled || undefined}
      className={styles.btn}
      onPointerDown={e => {
        if (disabled || e.button !== 0) return
        startHold(dir)
      }}
      onPointerUp={stopRepeat}
      onPointerLeave={stopRepeat}
      onPointerCancel={stopRepeat}
      onClick={disabled ? undefined : onClick(dir)}
    >
      <Icon name={dir < 0 ? 'minus' : 'plus'} size={20} />
    </button>
  )

  return (
    // biome-ignore lint/a11y/useSemanticElements: fieldset 的默认外观和图例在这里都用不上，role="group" 等价
    <div
      role="group"
      aria-label={labelledBy ? undefined : label}
      aria-labelledby={labelledBy}
      className={cx(styles.stepper, className)}
    >
      {button(-1, atMin)}
      <output id={outputId} aria-live="off" className={styles.value}>
        {format(value)}
      </output>
      {button(1, atMax)}
    </div>
  )
}
