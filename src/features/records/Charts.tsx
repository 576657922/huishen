import { type ReactNode, useLayoutEffect, useState } from 'react'
import { RECORDS } from '@/content/copy'
import type { CheckinPoint, StressRating } from '@/data'
import { dayKey, parseDayKey, startOfWeek } from '@/lib/date'
import styles from './Records.module.css'

export function CheckinStrips({ points, pre, post }: { points: CheckinPoint[]; pre: number; post: number }) {
  const largestStack = Math.max(
    0,
    ...(['pre', 'post'] as const).flatMap(key => {
      const counts = new Map<number, number>()
      for (const point of points) counts.set(point[key], (counts.get(point[key]) ?? 0) + 1)
      return [...counts.values()]
    }),
  )
  const rowHeight = Math.max(52, (Math.ceil(largestStack / 3) - 1) * 7 + 32)
  return (
    <svg
      viewBox={`0 0 350 ${rowHeight * 2 + 36}`}
      className={styles.strips}
      role="img"
      aria-label={RECORDS.checkin.plotLabel
        .replace('{pre}', String(pre))
        .replace('{post}', String(post))
        .replace('{n}', String(points.length))}
    >
      {(['pre', 'post'] as const).map((key, row) => {
        const counts = Array.from({ length: 11 }, () => 0)
        return (
          <g key={key}>
            <text x="0" y={rowHeight - 27 + row * rowHeight}>
              {key === 'pre' ? RECORDS.checkin.before : RECORDS.checkin.after}
            </text>
            <path className={styles.axis} d={`M58 ${rowHeight - 20 + row * rowHeight}H340`} />
            {points.map(p => {
              const value = p[key]
              const index = counts[value] ?? 0
              counts[value] = index + 1
              return (
                <circle
                  key={p.id}
                  className={styles.dot}
                  cx={64 + value * 27 + ((index % 3) - 1) * 6}
                  cy={rowHeight - 25 + row * rowHeight - Math.floor(index / 3) * 7}
                  r="2.5"
                />
              )
            })}
            <path
              className={styles.median}
              d={`M${64 + (key === 'pre' ? pre : post) * 27} ${rowHeight - 44 + row * rowHeight}v29`}
            />
          </g>
        )
      })}
      {[0, 2, 4, 6, 8, 10].map(v => (
        <text key={v} x={64 + v * 27} y={rowHeight * 2 + 18} textAnchor="middle">
          {v}
        </text>
      ))}
    </svg>
  )
}
export function StressPlot({
  ratings,
  width = 350,
  today,
}: {
  ratings: StressRating[]
  width?: number
  today: string
}) {
  const shown = ratings.slice(-8)
  const maximum = Math.max(5, ...shown.map(r => r.score))
  return (
    <svg
      className={styles.strips}
      viewBox={`0 0 ${width} 144`}
      role="img"
      aria-label={RECORDS.weeklyStress.plotLabel.replace(
        '{points}',
        shown
          .map(r =>
            RECORDS.weeklyStress.pointLabel.replace('{date}', r.date).replace('{score}', String(r.score)),
          )
          .join(' · '),
      )}
    >
      {(maximum === 5 ? [1, 3, 5] : [0, maximum / 2, maximum]).map(value => (
        <g key={value}>
          <path className={styles.gridline} d={`M24 ${114 - (value / maximum) * 100}H${width - 10}`} />
          <text x="0" y={118 - (value / maximum) * 100}>
            {value}
          </text>
        </g>
      ))}
      {shown.map((r, i) => (
        <g key={r.date}>
          <circle
            className={
              dayKey(startOfWeek(parseDayKey(r.date))) === dayKey(startOfWeek(parseDayKey(today)))
                ? styles.nowDot
                : styles.dot
            }
            cx={40 + (i / Math.max(shown.length - 1, 1)) * (width - 66)}
            cy={114 - (r.score / maximum) * 100}
            r="4"
          />
          <text x={40 + (i / Math.max(shown.length - 1, 1)) * (width - 66)} y="140" textAnchor="middle">
            {r.date.slice(5).replace('-', '/')}
          </text>
        </g>
      ))}
    </svg>
  )
}

export function PlotWidth({ children }: { children: (width: number) => ReactNode }) {
  const [element, setElement] = useState<HTMLDivElement | null>(null)
  const [width, setWidth] = useState(350)
  useLayoutEffect(() => {
    if (!element) return
    const update = (): void => {
      if (element.clientWidth > 0) setWidth(element.clientWidth)
    }
    update()
    if (typeof ResizeObserver === 'function') {
      const observer = new ResizeObserver(update)
      observer.observe(element)
      return () => observer.disconnect()
    }
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [element])
  return <div ref={setElement}>{children(width)}</div>
}
