import { useEffect, useState } from 'react'
import { dayKey, dayPart } from '@/lib/date'

/** 页面一直开着或从休眠恢复时，推荐也要跟着时段和日期变化。 */
export function useRecommendationTime(): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const update = (): void => {
      const current = new Date()
      setNow(previous =>
        dayKey(previous) === dayKey(current) && dayPart(previous) === dayPart(current) ? previous : current,
      )
      const next = new Date(current)
      const hour = [5, 11, 14, 18, 22, 24].find(value => value > current.getHours()) ?? 24
      next.setHours(hour, 0, 0, 100)
      clearTimeout(timer)
      timer = setTimeout(update, next.getTime() - current.getTime())
    }
    update()
    document.addEventListener('visibilitychange', update)
    window.addEventListener('focus', update)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', update)
      window.removeEventListener('focus', update)
    }
  }, [])
  return now
}
