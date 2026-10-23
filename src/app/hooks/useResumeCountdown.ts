import { useEffect, useState } from 'react'
import { usePendingSession } from '../flows/store'
import { getTimeScale } from '../services'

/**
 * 暂停之后倒数接着练（resumeAfterLeadIn）时还剩几秒：按练习的秒数向上取整（5、4、3、2、1），
 * 不在倒数时为 null。只在整秒变化时重新渲染
 */
export function useResumeCountdown(): number | null {
  const resumeAt = usePendingSession(s => s.resumeAt)
  const [now, setNow] = useState(() => performance.now())
  useEffect(() => {
    if (resumeAt === null) return
    let id: ReturnType<typeof setTimeout> | undefined
    const tick = (): void => {
      const t = performance.now()
      setNow(t)
      const left = (resumeAt - t) * getTimeScale()
      if (left <= 0) return
      // 下一次读数变化（练习时间的下一个整秒）时再更新
      id = setTimeout(tick, (left % 1000 || 1000) / getTimeScale() + 1)
    }
    tick()
    return () => clearTimeout(id)
  }, [resumeAt])
  if (resumeAt === null) return null
  return Math.max(0, Math.ceil(((resumeAt - now) * getTimeScale()) / 1000))
}
