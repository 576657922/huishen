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
      else drawCurve(p, Math.max(0, t), t)

      function drawCurve(p: Paint, time: number, rawTime: number): void {
        const cycle = ctrl.getState().plan?.pattern
        const period = 60 / (ctrl.getState().rate ?? (cycle ? 60 / cycle.T : 5.5))
        const start = p.reduced ? time - at!.seg!.t0 - at!.progress * at!.seg!.dur : time - 24
        const span = p.reduced ? period : 38
        const nowX = ((time - start) / span) * w
        const padY = 28
        const topY = padY
        const botY = h - padY
        const midY = (topY + botY) / 2
        const y = (v: number): number => botY - v * (botY - topY)
        const nowY = y(at!.y)

        // 1. 随吸呼深浅吐纳的深潭月光背景场
        const auraR = Math.max(w * 0.28, 220) * (0.85 + at!.y * 0.35)
        const aura = ctx.createRadialGradient(nowX, nowY, 0, nowX, nowY, auraR)
        aura.addColorStop(0, `rgb(214 222 234 / ${(0.08 + at!.y * 0.065).toFixed(3)})`)
        aura.addColorStop(0.45, `rgb(180 192 210 / ${(0.025 + at!.y * 0.02).toFixed(3)})`)
        aura.addColorStop(1, 'rgb(8 10 13 / 0)')
        ctx.fillStyle = aura
        ctx.fillRect(0, 0, w, h)

        // 2. 极轻上下边界基准线（弱化网格感，保留建筑标尺精度）
        ctx.strokeStyle = 'rgb(241 242 238 / 0.07)'
        ctx.lineWidth = 1
        ctx.setLineDash([])
        for (const yy of [topY, botY]) {
          ctx.beginPath()
          ctx.moveTo(0, yy + 0.5)
          ctx.lineTo(w, yy + 0.5)
          ctx.stroke()
        }

        // 10 秒超轻建筑纵标线
        if (!p.reduced) {
          for (let s = Math.ceil(start / 10) * 10; s < start + span; s += 10) {
            const x = Math.round(((s - start) / span) * w) + 0.5
            ctx.strokeStyle = 'rgb(241 242 238 / 0.045)'
            ctx.beginPath()
            ctx.moveTo(x, topY)
            ctx.lineTo(x, botY)
            ctx.stroke()
          }
        }

        // 预采样主曲线坐标（1 px 精度），兼用于多层水墨丝带与相位刻度
        const step = 2
        const pts: { x: number; y: number; v: number; t: number }[] = []
        const transitions: number[] = []
        let prevKey: string | undefined
        for (let x = 0; x <= w; x += step) {
          const sampleT = start + (x / w) * span
          if (sampleT < 0) continue
          const point = ctrl.breathAt(sampleT)
          if (!point) break
          pts.push({ x, y: y(point.y), v: point.y, t: sampleT })
          if (prevKey !== undefined && point.seg?.key !== prevKey) transitions.push(x)
          prevKey = point.seg?.key
        }

        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'

        // 3. 四层半透明谐波丝带：赋予呼吸地平线水墨流动般的立体景深
        if (!p.reduced && pts.length > 1) {
          const ribbons = [
            { scale: 0.72, shift: -10, phase: 0.55, alpha: 0.08, width: 1.25 },
            { scale: 0.52, shift: 12, phase: 1.35, alpha: 0.06, width: 1 },
            { scale: 1.08, shift: -5, phase: -0.4, alpha: 0.055, width: 1 },
            { scale: 0.86, shift: 16, phase: 2.1, alpha: 0.04, width: 0.9 },
          ]
          for (const rb of ribbons) {
            ctx.beginPath()
            for (let i = 0; i < pts.length; i++) {
              const pt = pts[i]!
              const harmonic = Math.sin(pt.t * 0.42 + rb.phase) * 7
              const ry = midY + (pt.y - midY) * rb.scale + rb.shift + harmonic
              if (i === 0) ctx.moveTo(pt.x, ry)
              else ctx.lineTo(pt.x, ry)
            }
            ctx.strokeStyle = `rgb(228 232 238 / ${rb.alpha})`
            ctx.lineWidth = rb.width
            ctx.stroke()
          }

          // 4. 随吸气轻升、呼气微沉的极细呼吸微尘
          for (let i = 0; i < 24; i++) {
            const seed = (i * 137.508) % 100
            const mx = ((seed / 100) * w + time * (4 + (i % 4) * 1.6)) % w
            const drift = Math.sin(time * 0.45 + i * 1.7) * 14
            const my = botY - (((i * 29) % 85) / 100) * (botY - topY) - at!.y * 12 + drift
            if (my < topY || my > botY) continue
            const distNow = Math.abs(mx - nowX) / w
            const alpha = Math.max(0.03, (0.22 - distNow * 0.2) * (0.65 + at!.y * 0.35))
            ctx.beginPath()
            ctx.arc(mx, my, i % 3 === 0 ? 1.4 : 0.95, 0, Math.PI * 2)
            ctx.fillStyle = `rgb(235 238 242 / ${alpha.toFixed(3)})`
            ctx.fill()
          }
        }

        // 5. 已走过的呼吸曲线：柔和渐变墨雾 + 双层发光主丝线
        const pastPts = pts.filter(pt => pt.x <= nowX)
        if (rawTime >= 0 && pastPts.length > 1) {
          ctx.beginPath()
          ctx.moveTo(pastPts[0]!.x, pastPts[0]!.y)
          for (let i = 1; i < pastPts.length; i++) ctx.lineTo(pastPts[i]!.x, pastPts[i]!.y)
          ctx.lineTo(nowX, nowY)
          ctx.lineTo(nowX, botY)
          ctx.lineTo(pastPts[0]!.x, botY)
          ctx.closePath()
          const grad = ctx.createLinearGradient(0, topY, 0, botY)
          grad.addColorStop(0, 'rgb(225 230 238 / 0.14)')
          grad.addColorStop(0.55, 'rgb(210 218 228 / 0.055)')
          grad.addColorStop(1, 'rgb(8 10 13 / 0)')
          ctx.fillStyle = grad
          ctx.fill()

          // 柔光外晕
          ctx.beginPath()
          ctx.moveTo(pastPts[0]!.x, pastPts[0]!.y)
          for (let i = 1; i < pastPts.length; i++) ctx.lineTo(pastPts[i]!.x, pastPts[i]!.y)
          ctx.lineTo(nowX, nowY)
          ctx.strokeStyle = 'rgb(235 239 245 / 0.16)'
          ctx.lineWidth = 6.5
          ctx.stroke()

          // 锐利主光丝
          ctx.strokeStyle = c.trace!
          ctx.lineWidth = 2.2
          ctx.stroke()
        }

        // 6. 未来呼吸轨迹：极轻虚线引导
        const futurePts = pts.filter(pt => pt.x >= nowX)
        if (futurePts.length > 0) {
          ctx.beginPath()
          ctx.moveTo(nowX, nowY)
          for (const pt of futurePts) ctx.lineTo(pt.x, pt.y)
          ctx.strokeStyle = 'rgb(226 230 236 / 0.28)'
          ctx.lineWidth = 1.35
          ctx.setLineDash([2, 6])
          ctx.stroke()
          ctx.setLineDash([])
        }

        // 7. 相位切换底缘微刻度
        if (transitions.length) {
          ctx.strokeStyle = 'rgb(241 242 238 / 0.18)'
          ctx.lineWidth = 1
          for (const tx of transitions) {
            const rx = Math.round(tx) + 0.5
            ctx.beginPath()
            ctx.moveTo(rx, botY + 1)
            ctx.lineTo(rx, botY + 7)
            ctx.stroke()
          }
        }

        // 8. 渐隐垂直此刻准线
        const nowLineX = Math.round(nowX) + 0.5
        const lineGrad = ctx.createLinearGradient(0, topY, 0, botY)
        lineGrad.addColorStop(0, 'rgb(241 242 238 / 0)')
        lineGrad.addColorStop(0.22, 'rgb(241 242 238 / 0.16)')
        lineGrad.addColorStop(0.78, 'rgb(241 242 238 / 0.16)')
        lineGrad.addColorStop(1, 'rgb(241 242 238 / 0)')
        ctx.strokeStyle = lineGrad
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(nowLineX, topY)
        ctx.lineTo(nowLineX, botY)
        ctx.stroke()

        dot(ctx, nowX, nowY, c)
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
          'ink',
          'ink-2',
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
  // Luminous optical vermilion aura (static, non-pulsing, WCAG 2.3.1 compliant)
  const glow = ctx.createRadialGradient(x, y, 2, x, y, 22)
  glow.addColorStop(0, 'rgb(239 82 54 / 0.34)')
  glow.addColorStop(0.5, 'rgb(239 82 54 / 0.1)')
  glow.addColorStop(1, 'rgb(239 82 54 / 0)')
  ctx.fillStyle = glow
  ctx.beginPath()
  ctx.arc(x, y, 22, 0, Math.PI * 2)
  ctx.fill()

  // Fine optical reticle ring
  ctx.save()
  ctx.beginPath()
  ctx.arc(x, y, 10.5, 0, Math.PI * 2)
  ctx.strokeStyle = colors.now!
  ctx.globalAlpha = 0.34
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.restore()

  // Obsidian ground knockout ring
  ctx.beginPath()
  ctx.arc(x, y, 6.75, 0, Math.PI * 2)
  ctx.fillStyle = colors.paper!
  ctx.fill()

  // Lacquer vermilion now-dot
  ctx.beginPath()
  ctx.arc(x, y, 5, 0, Math.PI * 2)
  ctx.fillStyle = colors.now!
  ctx.fill()
}

function drawBox({ ctx, width, height, colors: c, reduced }: Paint, point: PatternPoint): void {
  const padX = 52
  const padY = 38
  const baseSize = Math.max(130, Math.min(width - padX * 2, height - padY * 2))
  const breathScale = reduced ? 0 : (point.y - 0.5) * 10
  const size = baseSize + breathScale
  const x = Math.round((width - size) / 2) + 0.5
  const y = Math.round((height - size) / 2) + 0.5
  const cxMid = width / 2
  const cyMid = height / 2

  // Deep atmospheric glow inside the architectural breath chamber
  const chamberGlow = ctx.createRadialGradient(cxMid, cyMid, 8, cxMid, cyMid, size * 0.95)
  chamberGlow.addColorStop(0, `rgb(218 225 236 / ${(0.065 + point.y * 0.055).toFixed(3)})`)
  chamberGlow.addColorStop(0.6, `rgb(180 192 210 / ${(0.018 + point.y * 0.018).toFixed(3)})`)
  chamberGlow.addColorStop(1, 'rgb(8 10 13 / 0)')
  ctx.fillStyle = chamberGlow
  ctx.fillRect(0, 0, width, height)

  // Nested concentric breath-echo chambers
  for (const offset of [16, 30]) {
    ctx.strokeStyle = offset === 16 ? 'rgb(241 242 238 / 0.06)' : 'rgb(241 242 238 / 0.03)'
    ctx.lineWidth = 1
    ctx.strokeRect(x + offset, y + offset, Math.max(20, size - offset * 2), Math.max(20, size - offset * 2))
  }

  // Exterior Swiss printmaker's corner registration crop marks
  const crop = 7
  ctx.strokeStyle = 'rgb(241 242 238 / 0.16)'
  ctx.lineWidth = 1
  const corners = [
    [x, y, -1, -1],
    [x + size, y, 1, -1],
    [x + size, y + size, 1, 1],
    [x, y + size, -1, 1],
  ] as const
  for (const [cx, cy, sx, sy] of corners) {
    ctx.beginPath()
    ctx.moveTo(cx + sx * 4, cy)
    ctx.lineTo(cx + sx * (4 + crop), cy)
    ctx.moveTo(cx, cy + sy * 4)
    ctx.lineTo(cx, cy + sy * (4 + crop))
    ctx.stroke()
  }

  // Main architectural perimeter
  ctx.strokeStyle = 'rgb(241 242 238 / 0.18)'
  ctx.lineWidth = 1
  ctx.strokeRect(x, y, size, size)

  const ends = [
    [x, y + size, x, y],
    [x, y, x + size, y],
    [x + size, y, x + size, y + size],
    [x + size, y + size, x, y + size],
  ] as const
  const activeIdx = point.idx % 4
  const side = ends[activeIdx]!
  const dx = side[0] + (side[2] - side[0]) * point.progress
  const dy = side[1] + (side[3] - side[1]) * point.progress

  // Luminous memory trace of completed sides + double-pass active silk edge
  if (!reduced) {
    ctx.strokeStyle = 'rgb(241 242 238 / 0.32)'
    ctx.lineWidth = 1.5
    ctx.lineCap = 'round'
    for (let i = 0; i < activeIdx; i++) {
      const done = ends[i]!
      ctx.beginPath()
      ctx.moveTo(done[0], done[1])
      ctx.lineTo(done[2], done[3])
      ctx.stroke()
    }

    ctx.strokeStyle = 'rgb(235 239 245 / 0.18)'
    ctx.lineWidth = 6.5
    ctx.beginPath()
    ctx.moveTo(side[0], side[1])
    ctx.lineTo(dx, dy)
    ctx.stroke()

    ctx.strokeStyle = c.trace!
    ctx.lineWidth = 2.25
    ctx.beginPath()
    ctx.moveTo(side[0], side[1])
    ctx.lineTo(dx, dy)
    ctx.stroke()
  }

  const pattern = getController().getState().plan?.pattern
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const positions = [
    [x - 20, y + size / 2],
    [x + size / 2, y - 16],
    [x + size + 20, y + size / 2],
    [x + size / 2, y + size + 18],
  ] as const
  pattern?.segs.forEach((seg, i) => {
    const pos = positions[i]!
    const isCurrent = i === activeIdx
    const label = PLAYER.paced.side.replace('{phase}', seg.label).replace('{seconds}', String(seg.dur))
    ctx.fillStyle = isCurrent ? c.ink! : c['ink-3']!
    ctx.font = `${isCurrent ? '600' : '400'} 11px ${c['font-ui']}`
    if (i % 2 === 0) {
      ctx.save()
      ctx.translate(pos[0], pos[1])
      ctx.rotate(i === 0 ? -Math.PI / 2 : Math.PI / 2)
      ctx.fillText(label, 0, 0)
      ctx.restore()
    } else {
      ctx.fillText(label, pos[0], pos[1])
    }
  })

  dot(ctx, dx, dy, c)
}
