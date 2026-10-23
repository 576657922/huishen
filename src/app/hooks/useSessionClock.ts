import { useEffect, useRef, useState } from 'react'
import { getController } from '../services'

/**
 * 每一帧用会话时间 controller.time()（秒，倒数期间为负，暂停时停住）调一次 onFrame，不触发 React 渲染：
 * 呼吸曲线、方框节拍器这类画布每帧自己画。页面在后台时浏览器不跑 requestAnimationFrame，
 * 回到前台的第一帧直接画当前时刻，没有追赶。active 为 false 时停下
 */
export function useSessionClock(onFrame: (t: number) => void, active = true): void {
  const ref = useRef(onFrame)
  useEffect(() => {
    ref.current = onFrame
  })
  useEffect(() => {
    if (!active) return
    let id = 0
    const frame = (): void => {
      ref.current(getController().time())
      id = requestAnimationFrame(frame)
    }
    id = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(id)
  }, [active])
}

/**
 * 会话时间的整秒数（向下取整），每过一秒才重新渲染一次：给剩余时间、已练时间这类读数用
 */
export function useSessionSecond(active = true): number {
  const [second, setSecond] = useState(() => Math.floor(getController().time()))
  const last = useRef(second)
  useSessionClock(t => {
    const s = Math.floor(t)
    if (s === last.current) return
    last.current = s
    setSecond(s)
  }, active)
  return second
}
