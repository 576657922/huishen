import { type RefObject, useLayoutEffect, useRef, useState } from 'react'

/**
 * 占满一栏的图（段落图、回神时间线、节律示意、自评点图）按栏的实际宽度重算几何，而不是把 350 宽的图缩放：
 * 缩放会让 11 px 的轴标签跟着变小（360 宽的手机）或变大（播放器在平板和桌面上是 640 的栏）。
 * 给了 width 就用它；还没量到（第一次渲染、测试环境）时用 fallback。在绘制之前量，不会先闪一下 350 宽的图。
 */
export function useFigureWidth<T extends HTMLElement>(
  width: number | undefined,
  fallback: number,
): [RefObject<T | null>, number] {
  const ref = useRef<T>(null)
  const [measured, setMeasured] = useState<number | null>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (width !== undefined || !el) return
    const read = () => {
      const w = Math.floor(el.getBoundingClientRect().width)
      if (w > 0) setMeasured(w)
    }
    read()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(read)
    observer.observe(el)
    return () => observer.disconnect()
  }, [width])
  return [ref, width ?? measured ?? fallback]
}
