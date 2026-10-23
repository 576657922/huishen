import { useCallback, useEffect, useRef, useState } from 'react'
import { useSessionClock, useSessionState } from '@/app/hooks'
import { getController } from '@/app/services'
import { PLAYER } from '@/content/copy'
import type { PatternPoint } from '@/engine'
import styles from './SessionStage.module.css'

type Paint = {
  ctx: CanvasRenderingContext2D
  width: number
  height: number
  colors: Record<string, string>
  reduced: boolean
}

/** 绘图只读控制器的时钟；尺寸和颜色在布局变化时读取，不放进每帧循环。 */
export function BreathCanvas({ box = false, frozenTime }: { box?: boolean; frozenTime?: number }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const paint = useRef<Paint | null>(null)
  const state = useSessionState()
  const [visible, setVisible] = useState(!document.hidden)
  const draw = useCallback(
    (clock: number): void => {
      const t = frozenTime ?? clock
      const p = paint.current
      if (!p) return
      const { ctx, width: w, height: h, colors: c } = p
      ctx.clearRect(0, 0, w, h)
      const ctrl = getController()
      const at = ctrl.breathAt(Math.max(0, t))
      if (!at?.seg) return
      if (box) drawBox(p, at)
      else drawCurve(p, Math.max(0, t))
      function drawCurve(p: Paint, time: number): void {
        const cycle = ctrl.getState().plan?.pattern
        const period = 60 / (ctrl.getState().rate ?? (cycle ? 60 / cycle.T : 5.5))
        const start = p.reduced ? time - at!.seg!.t0 - at!.progress * at!.seg!.dur : time - 24
        const span = p.reduced ? period : 38
        const nowX = ((time - start) / span) * w
        const y = (v: number): number => h - 18 - v * (h - 36)
        ctx.strokeStyle = c['grid-major']!
        ctx.lineWidth = 1
        for (const yy of [18, h - 18]) {
          ctx.beginPath()
          ctx.moveTo(0, yy)
          ctx.lineTo(w, yy)
          ctx.stroke()
        }
        if (!p.reduced)
          for (let s = Math.ceil(start / 5) * 5; s < start + span; s += 5) {
            const x = ((s - start) / span) * w
            ctx.strokeStyle = c[s % 10 === 0 ? 'grid-major' : 'grid']!
            ctx.beginPath()
            ctx.moveTo(x, 18)
            ctx.lineTo(x, h - 18)
            ctx.stroke()
          }
        const trace = (from: number, to: number): number => {
          let last = from
          ctx.beginPath()
          let drawn = false
          for (let x = from; x <= to; x += 1.5) {
            const point = ctrl.breathAt(Math.max(0, start + (x / w) * span))
            if (!point) break
            if (!drawn) ctx.moveTo(x, y(point.y))
            else ctx.lineTo(x, y(point.y))
            drawn = true
            last = x
          }
          return last
        }
        if (t >= 0) {
          const last = trace(Math.max(0, (-start / span) * w), nowX)
          ctx.lineTo(last, h - 18)
          ctx.lineTo(Math.max(0, (-start / span) * w), h - 18)
          ctx.closePath()
          ctx.fillStyle = c['trace-fill']!
          ctx.fill()
          trace(Math.max(0, (-start / span) * w), nowX)
          ctx.strokeStyle = c.trace!
          ctx.lineWidth = 2
          ctx.setLineDash([])
          ctx.stroke()
        }
        trace(nowX, w)
        ctx.strokeStyle = c['trace-future']!
        ctx.lineWidth = 1.5
        ctx.setLineDash([2, 5])
        ctx.stroke()
        ctx.setLineDash([])
        ctx.strokeStyle = c['grid-major']!
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(nowX, 18)
        ctx.lineTo(nowX, h - 18)
        ctx.stroke()
        dot(ctx, nowX, y(at!.y), c)
      }
    },
    [box, frozenTime],
  )
  useEffect(() => {
    const element = canvas.current
    if (!element) return
    const motion = matchMedia('(prefers-reduced-motion: reduce)')
    const update = (): void => {
      const rect = element.getBoundingClientRect()
      const dpr = Math.min(devicePixelRatio || 1, 3)
      element.width = Math.round(rect.width * dpr)
      element.height = Math.round(rect.height * dpr)
      const ctx = element.getContext('2d')
      if (!ctx || rect.width === 0) return
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const css = getComputedStyle(element)
      const colors = Object.fromEntries(
        [
          'trace',
          'trace-future',
          'trace-fill',
          'grid',
          'grid-major',
          'line',
          'now',
          'paper',
          'ink-3',
          'font-ui',
        ].map(key => [key, css.getPropertyValue(`--${key}`).trim()]),
      )
      paint.current = { ctx, width: rect.width, height: rect.height, colors, reduced: motion.matches }
      draw(getController().time())
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    motion.addEventListener('change', update)
    const visibility = (): void => setVisible(!document.hidden)
    document.addEventListener('visibilitychange', visibility)
    return () => {
      observer.disconnect()
      motion.removeEventListener('change', update)
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [draw])
  useEffect(() => {
    if (state.status !== 'idle') draw(getController().time())
  }, [state, draw])
  useSessionClock(
    draw,
    frozenTime === undefined && visible && (state.status === 'running' || state.status === 'lead'),
  )
  return (
    <canvas
      ref={canvas}
      className={box ? styles.box : styles.curve}
      role="img"
      aria-label={box ? PLAYER.paced.boxFigure : PLAYER.paced.figure}
    />
  )
}

function dot(ctx: CanvasRenderingContext2D, x: number, y: number, colors: Record<string, string>): void {
  ctx.beginPath()
  ctx.arc(x, y, 6, 0, Math.PI * 2)
  ctx.fillStyle = colors.paper!
  ctx.fill()
  ctx.beginPath()
  ctx.arc(x, y, 5, 0, Math.PI * 2)
  ctx.fillStyle = colors.now!
  ctx.fill()
}
function drawBox({ ctx, width, height, colors: c, reduced }: Paint, point: PatternPoint): void {
  const size = Math.min(width - 56, height - 56)
  const x = 28,
    y = 28
  ctx.strokeStyle = c.line!
  ctx.lineWidth = 1
  ctx.strokeRect(x, y, size, size)
  const ends = [
    [x, y + size, x, y],
    [x, y, x + size, y],
    [x + size, y, x + size, y + size],
    [x + size, y + size, x, y + size],
  ]
  const side = ends[point.idx % 4]!
  const dx = side[0]! + (side[2]! - side[0]!) * point.progress
  const dy = side[1]! + (side[3]! - side[1]!) * point.progress
  if (!reduced) {
    ctx.strokeStyle = c.trace!
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(side[0]!, side[1]!)
    ctx.lineTo(dx, dy)
    ctx.stroke()
  }
  const pattern = getController().getState().plan?.pattern
  ctx.fillStyle = c['ink-3']!
  ctx.font = `11px ${c['font-ui']}`
  ctx.textAlign = 'center'
  const positions = [
    [x - 14, y + size / 2],
    [x + size / 2, y - 12],
    [x + size + 14, y + size / 2],
    [x + size / 2, y + size + 22],
  ]
  pattern?.segs.forEach((seg, i) => {
    const pos = positions[i]!
    const label = PLAYER.paced.side.replace('{phase}', seg.label).replace('{seconds}', String(seg.dur))
    if (i % 2 === 0) {
      ctx.save()
      ctx.translate(pos[0]!, pos[1]!)
      ctx.rotate(i === 0 ? -Math.PI / 2 : Math.PI / 2)
      ctx.fillText(label, 0, 0)
      ctx.restore()
    } else ctx.fillText(label, pos[0]!, pos[1]!)
  })
  dot(ctx, dx, dy, c)
}
