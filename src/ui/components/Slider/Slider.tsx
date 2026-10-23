import { type KeyboardEvent, type PointerEvent, useRef } from 'react'
import { cx } from '../../cx'
import styles from './Slider.module.css'

export interface SliderProps {
  min: number
  max: number
  /** 方向键一步，取值对齐到它（节律 0.5） */
  step: number
  /** PageUp / PageDown 一大步；默认两步 */
  majorStep?: number
  value: number
  onChange: (value: number) => void
  /** 读屏读的值，用文字说：「每分钟 5.5 次」 */
  valueText?: (value: number) => string
  /** 轨道下标出的刻度值；每个刻度值是大刻度，相邻两个之间一个小刻度 */
  scale?: readonly number[]
  /** 刻度上的写法：节律一律一位小数（5.0），默认 toFixed(1) */
  formatScale?: (value: number) => string
  label?: string
  labelledBy?: string
  describedBy?: string
  disabled?: boolean
  className?: string
}

const decimalsOf = (x: number): number => (String(x).split('.')[1] ?? '').length

/**
 * 滑块（DESIGN.md §8.8）：56 高，2 px 线色轨道，左边到当前值是墨色，24 的钮。
 * 在 44 高的带子上任意处按下拖动，取值对齐到步长；← → 一步，PageUp / PageDown 一大步，Home / End 到两端。
 * 当前值的刻度标签墨色 600（aria-current），值本身由所在的行印在右边（「5.5 次/分」）。
 */
export function Slider({
  min,
  max,
  step,
  majorStep = step * 2,
  value,
  onChange,
  valueText,
  scale,
  formatScale = v => v.toFixed(1),
  label,
  labelledBy,
  describedBy,
  disabled = false,
  className,
}: SliderProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const places = Math.max(decimalsOf(step), decimalsOf(min))

  const snap = (v: number): number => {
    const stepped = min + Math.round((v - min) / step) * step
    return Number(Math.min(max, Math.max(min, stepped)).toFixed(places))
  }
  const commit = (v: number) => {
    const next = snap(v)
    if (next !== value) onChange(next)
  }
  const fromPointer = (clientX: number): number => {
    const r = rootRef.current?.getBoundingClientRect()
    if (!r || r.width <= 24) return value
    const f = Math.min(1, Math.max(0, (clientX - r.left - 12) / (r.width - 24)))
    return min + f * (max - min)
  }

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (disabled || e.button !== 0) return
    dragging.current = true
    e.currentTarget.setPointerCapture?.(e.pointerId)
    commit(fromPointer(e.clientX))
  }
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (dragging.current) commit(fromPointer(e.clientX))
  }
  const stop = () => {
    dragging.current = false
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return
    const moves: Record<string, number> = {
      ArrowRight: value + step,
      ArrowUp: value + step,
      ArrowLeft: value - step,
      ArrowDown: value - step,
      PageUp: value + majorStep,
      PageDown: value - majorStep,
      Home: min,
      End: max,
    }
    const to = moves[e.key]
    if (to === undefined) return
    e.preventDefault()
    commit(to)
  }

  const frac = (v: number): number => (max > min ? (v - min) / (max - min) : 0)
  const f = frac(value)
  const minors = (scale ?? []).slice(1).map((v, i) => ((scale?.[i] ?? v) + v) / 2)

  return (
    <div
      ref={rootRef}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={valueText?.(value)}
      aria-label={labelledBy ? undefined : label}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      aria-disabled={disabled || undefined}
      className={cx(styles.slider, className)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={stop}
      onPointerCancel={stop}
      onLostPointerCapture={stop}
      onKeyDown={onKeyDown}
    >
      <div className={styles.track} />
      <div className={styles.fill} style={{ width: `calc((100% - 24px) * ${f})` }} />
      {scale && (
        <div className={styles.ticks} aria-hidden="true">
          {scale.map(v => (
            <i key={`M${v}`} className={styles.major} style={{ left: `${frac(v) * 100}%` }} />
          ))}
          {minors.map(v => (
            <i key={`m${v}`} style={{ left: `${frac(v) * 100}%` }} />
          ))}
        </div>
      )}
      <div className={styles.thumb} style={{ left: `calc(12px + (100% - 24px) * ${f})` }} />
      {scale && (
        <div className={styles.scale} aria-hidden="true">
          {scale.map((v, i) => (
            <span
              key={v}
              aria-current={v === value ? 'true' : undefined}
              data-edge={i === 0 ? 'start' : i === scale.length - 1 ? 'end' : undefined}
              style={{ left: `${frac(v) * 100}%` }}
            >
              {formatScale(v)}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
