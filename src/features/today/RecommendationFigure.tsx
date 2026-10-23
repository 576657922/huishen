import { useLayoutEffect, useState } from 'react'
import { DETAIL, SETTINGS, TODAY } from '@/content/copy'
import { isCatalogPracticeId } from '@/content/practices'
import { getScript } from '@/content/scripts'
import type { Practice } from '@/content/types'
import { buildPattern, buildTimeline, patternAt } from '@/engine'
import { BreathGlyph, isGlyphId } from '@/ui'
import styles from './Today.module.css'

export function RecommendationFigure({ practice, minutes }: { practice: Practice; minutes: number }) {
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
  return (
    <div ref={setElement}>
      <Figure practice={practice} minutes={minutes} width={width} />
    </div>
  )
}
function Figure({ practice, minutes, width }: { practice: Practice; minutes: number; width: number }) {
  const caption = isCatalogPracticeId(practice.id) ? DETAIL.figureCaption[practice.id] : practice.short
  const detail = false
  if (practice.paced) {
    const pattern = buildPattern(practice.paced)
    const span = pattern.T * (detail ? (practice.id === 'slow' ? 3 : 1) : 2)
    const bottom = detail ? 94 : 80
    const height = detail ? 120 : 96
    const amplitude = detail ? 80 : 64
    const d = Array.from(
      { length: 361 },
      (_, i) =>
        `${i ? 'L' : 'M'}${((i / 360) * width).toFixed(2)} ${(bottom - patternAt(pattern, (i / 360) * span).y * amplitude).toFixed(2)}`,
    ).join(' ')
    const ticks = Array.from(
      { length: Math.ceil(span / (span > 20 ? 10 : 5)) },
      (_, i) => i * (span > 20 ? 10 : 5),
    )
    return (
      <svg className={styles.plot} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={caption}>
        {detail && (
          <>
            {Array.from({ length: Math.floor(span) + 1 }, (_, sec) => sec).map(sec => (
              <path
                key={sec}
                className={sec % 10 === 0 ? styles.gridMajor : styles.gridMinor}
                d={`M${(sec / span) * width} 14V94`}
              />
            ))}
            {pattern.segs.map(seg => (
              <g key={seg.key}>
                <path
                  className={styles.axis}
                  d={`M${(seg.t0 / span) * width} 5v-4h${(seg.dur / span) * width}v4`}
                />
                <text x={((seg.t0 + seg.dur / 2) / span) * width} y="-3" textAnchor="middle">
                  {seg.label} {Math.round(seg.dur * 2) / 2}
                </text>
              </g>
            ))}
            <path className={styles.axis} d={`M0 94.5H${width}`} />
            {ticks.map((sec, i) => (
              <text key={sec} x={(sec / span) * width} y="115" textAnchor={sec === 0 ? 'start' : 'middle'}>
                {i === ticks.length - 1 ? SETTINGS.practice.leadIn.value(sec) : sec}
              </text>
            ))}
          </>
        )}
        <path className={styles.trace} d={d} />
      </svg>
    )
  }
  if (practice.id === 'focus')
    return (
      <>
        <svg className={styles.plot} viewBox={`0 0 ${width} 72`} role="img" aria-label={TODAY.focusCaption}>
          <path
            className={styles.axis}
            d={`M0 40.5H${width}M0.5 40v5M${width / 2} 40v5M${width - 0.5} 40v5`}
          />
          <text x="0" y="64">
            0
          </text>
          <text x={width / 2} y="64" textAnchor="middle">
            {minutes / 2}
          </text>
          <text x={width} y="64" textAnchor="end">
            {TODAY.minutes(minutes)}
          </text>
        </svg>
        {!detail && <figcaption className="t-caption ink-3">{TODAY.focusCaption}</figcaption>}
      </>
    )
  if (practice.id === 'body-scan' && practice.scriptId) {
    const timeline = buildTimeline(getScript(practice.scriptId), minutes, {
      level: 'standard',
      charsPerSecond: 4,
    })
    const sections = [
      { id: 'opening', title: TODAY.start, t0: 0, t1: timeline.sections[0]?.t0 ?? 0 },
      ...timeline.sections,
    ]
    const bottom = 15 + (sections.length - 1) * (detail ? 6 : 5)
    return (
      <svg className={styles.plot} viewBox={`0 0 ${width} ${bottom + 28}`} role="img" aria-label={caption}>
        {sections.map((s, i) => {
          const x = (s.t0 / timeline.duration) * width
          const next = sections[i + 1]?.t0 ?? timeline.duration
          const y = bottom - i * (detail ? 6 : 5)
          return (
            <g key={s.id}>
              <path
                className={styles.trace}
                d={`M${x} ${y + (i ? (detail ? 6 : 5) : 0)}V${y}H${(next / timeline.duration) * width}`}
              />
              <text x={x + (i ? 3 : 0)} y={y - 5}>
                {s.title.split(/[、和]/)[0]?.slice(0, 2)}
              </text>
            </g>
          )
        })}
        <path className={styles.axis} d={`M0 ${bottom + 7.5}H${width}`} />
        {Array.from({ length: minutes + 1 }, (_, i) => (i / minutes) * width).map(x => (
          <path key={x} className={styles.axis} d={`M${x} ${bottom + 8}v3`} />
        ))}
        <text x="0" y={bottom + 27}>
          0
        </text>
        <text x={width / 2} y={bottom + 27} textAnchor="middle">
          {minutes / 2}
        </text>
        <text x={width} y={bottom + 27} textAnchor="end">
          {TODAY.minutes(minutes)}
        </text>
      </svg>
    )
  }
  if (practice.kind === 'guided' && practice.scriptId && practice.id !== 'pause') {
    const timeline = buildTimeline(getScript(practice.scriptId), minutes, { level: 'standard' })
    const sections = [
      { id: 'opening', title: TODAY.start, t0: 0, t1: timeline.sections[0]?.t0 ?? 0 },
      ...timeline.sections,
    ]
    return (
      <svg className={styles.plot} viewBox={`0 0 ${width} 72`} role="img" aria-label={caption}>
        {sections.map(s => (
          <g key={s.id}>
            <path
              className={styles.trace}
              d={`M${(s.t0 / timeline.duration) * width} 30H${(s.t1 / timeline.duration) * width - 3}`}
            />
            <text x={(s.t0 / timeline.duration) * width} y="20">
              {s.title.split(/[、，]/)[0]?.slice(0, 2)}
            </text>
          </g>
        ))}
        <text x="0" y="60">
          0
        </text>
        <text x={width} y="60" textAnchor="end">
          {TODAY.minutes(minutes)}
        </text>
      </svg>
    )
  }
  if (practice.kind === 'sound')
    return (
      <svg className={styles.plot} viewBox={`0 0 ${width} 80`} role="img" aria-label={caption}>
        <path
          className={styles.trace}
          d={`M0 16H${width * 0.8}C${width * 0.9} 16 ${width * 0.9} 64 ${width} 64`}
        />
        <path className={styles.axis} d={`M0 64.5H${width}`} />
      </svg>
    )
  return isGlyphId(practice.id) ? <BreathGlyph id={practice.id} scale={4} /> : null
}
