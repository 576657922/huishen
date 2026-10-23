import { type KeyboardEvent, useRef, useState } from 'react'

export interface RadioGroupOptions<T> {
  values: readonly T[]
  value: T | null | undefined
  onChange: (value: T) => void
  /**
   * true：方向键移动并选中（分段控件、筛选，DESIGN.md §8.8）；
   * false：方向键只移动焦点，空格或回车才选中——用在点一下就提交的题（练完感觉、0–10），
   * 免得用方向键经过「很不舒服」时就把它选上了
   */
  selectOnMove: boolean
  /** 两行排列时（0–10 分两行，每行 6 格）上下键跨行 */
  columns?: number
}

/**
 * 单选组的漫游焦点：组里只有一个可 Tab 到的格子（选中的那个；没有选中时是第一个或上次停留的），
 * 方向键在格子之间移动，Home / End 到两端
 */
export function useRadioGroup<T>({ values, value, onChange, selectOnMove, columns }: RadioGroupOptions<T>) {
  const refs = useRef<(HTMLElement | null)[]>([])
  const [active, setActive] = useState(0)
  const checked = value === null || value === undefined ? -1 : values.indexOf(value)
  const current = checked >= 0 ? checked : Math.min(active, values.length - 1)
  const count = values.length

  const move = (to: number) => {
    setActive(to)
    refs.current[to]?.focus()
    const next = values[to]
    if (selectOnMove && next !== undefined) onChange(next)
  }

  const onKeyDown = (index: number) => (e: KeyboardEvent<HTMLElement>) => {
    let to = -1
    switch (e.key) {
      case 'ArrowRight':
        to = (index + 1) % count
        break
      case 'ArrowLeft':
        to = (index - 1 + count) % count
        break
      case 'ArrowDown':
        to = columns ? (index + columns < count ? index + columns : index) : (index + 1) % count
        break
      case 'ArrowUp':
        to = columns ? (index - columns >= 0 ? index - columns : index) : (index - 1 + count) % count
        break
      case 'Home':
        to = 0
        break
      case 'End':
        to = count - 1
        break
      default:
        return
    }
    e.preventDefault()
    if (to !== index) move(to)
  }

  return {
    ref: (index: number) => (el: HTMLElement | null) => {
      refs.current[index] = el
    },
    tabIndex: (index: number) => (index === current ? 0 : -1),
    onKeyDown,
    onFocus: (index: number) => () => setActive(index),
  }
}
