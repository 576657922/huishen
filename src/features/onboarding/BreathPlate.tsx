import { useEffect, useRef } from 'react'
import styles from './Welcome.module.css'

/**
 * 首次打开页的沉浸式深潭呼吸画幅：
 * 5.5 次/分（吸 4.5 秒 · 呼 6.5 秒）的多层谐波丝带与呼吸月光雾晕，搭配一枚朱砂此刻落点。
 */
export function BreathPlate() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const motion = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    let reduced = motion?.matches ?? false
    let width = 0
    let height = 0
    let raf = 0

    const resize = (): void => {
      const rect = canvas.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5)
      width = rect.width
      height = rect.height
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      render(performance.now() / 1000)
    }

    const sample = (t: number): number => {
      const period = 11
      const inhale = 4.5
      const ph = ((t % period) + period) % period
      return ph < inhale
        ? (1 - Math.cos((Math.PI * ph) / inhale)) / 2
        : (1 + Math.cos((Math.PI * (ph - inhale)) / (period - inhale))) / 2
    }

    const render = (nowSec: number): void => {
      if (width <= 0 || height <= 0) return
      ctx.clearRect(0, 0, width, height)
      const t = reduced ? 13.75 : nowSec
      const span = 24
      const pastSpan = 15.2
      const start = t - pastSpan
      const nowX = (pastSpan / span) * width
      const topY = height * 0.24
      const botY = height * 0.76
      const midY = (topY + botY) / 2
      const y = (v: number): number => botY - v * (botY - topY)
      const curV = sample(t)
      const dotY = y(curV)

      // 1. 随吸呼吐纳的深潭月光背景场
      const auraR = Math.max(width, height) * (0.44 + curV * 0.14)
      const aura = ctx.createRadialGradient(nowX, dotY, 0, nowX, dotY, auraR)
      aura.addColorStop(0, `rgb(218 226 238 / ${(0.11 + curV * 0.065).toFixed(3)})`)
      aura.addColorStop(0.45, `rgb(176 190 212 / ${(0.032 + curV * 0.022).toFixed(3)})`)
      aura.addColorStop(1, 'rgb(8 10 13 / 0)')
      ctx.fillStyle = aura
      ctx.fillRect(0, 0, width, height)

      // 2. 极轻建筑基准横线
      ctx.strokeStyle = 'rgb(241 242 238 / 0.07)'
      ctx.lineWidth = 1
      ctx.setLineDash([])
      for (const yy of [topY, botY]) {
        ctx.beginPath()
        ctx.moveTo(0, Math.round(yy) + 0.5)
        ctx.lineTo(width, Math.round(yy) + 0.5)
        ctx.stroke()
      }

      // 采样
      const pts: { x: number; y: number; t: number }[] = []
      for (let x = 0; x <= width; x += 2) {
        const st = start + (x / width) * span
        pts.push({ x, y: y(sample(st)), t: st })
      }

      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'

      // 3. 四层半透明谐波水墨丝带
      if (!reduced && pts.length > 1) {
        const ribbons = [
          { scale: 0.74, shift: -12, phase: 0.6, alpha: 0.095, width: 1.3 },
          { scale: 0.52, shift: 14, phase: 1.5, alpha: 0.07, width: 1 },
          { scale: 1.09, shift: -6, phase: -0.45, alpha: 0.06, width: 1 },
          { scale: 0.88, shift: 18, phase: 2.3, alpha: 0.045, width: 0.9 },
        ]
        for (const rb of ribbons) {
          ctx.beginPath()
          for (let i = 0; i < pts.length; i++) {
            const pt = pts[i]!
            const harmonic = Math.sin(pt.t * 0.4 + rb.phase) * 8
            const ry = midY + (pt.y - midY) * rb.scale + rb.shift + harmonic
            if (i === 0) ctx.moveTo(pt.x, ry)
            else ctx.lineTo(pt.x, ry)
          }
          ctx.strokeStyle = `rgb(230 235 242 / ${rb.alpha})`
          ctx.lineWidth = rb.width
          ctx.stroke()
        }

        // 4. 呼吸微尘
        for (let i = 0; i < 20; i++) {
          const seed = (i * 137.508) % 100
          const mx = ((seed / 100) * width + t * (4 + (i % 3) * 1.8)) % width
          const my = botY - (((i * 31) % 82) / 100) * (botY - topY) - curV * 10 + Math.sin(t * 0.5 + i) * 10
          if (my < topY || my > botY) continue
          const alpha = 0.06 + (1 - Math.abs(mx - nowX) / width) * 0.16
          ctx.beginPath()
          ctx.arc(mx, my, i % 3 === 0 ? 1.4 : 0.9, 0, Math.PI * 2)
          ctx.fillStyle = `rgb(238 241 245 / ${alpha.toFixed(3)})`
          ctx.fill()
        }
      }

      // 5. 过去波段：柔光渐隐填充 + 双层发光主丝线
      const pastPts = pts.filter(pt => pt.x <= nowX)
      if (pastPts.length > 1) {
        ctx.beginPath()
        ctx.moveTo(pastPts[0]!.x, pastPts[0]!.y)
        for (let i = 1; i < pastPts.length; i++) ctx.lineTo(pastPts[i]!.x, pastPts[i]!.y)
        ctx.lineTo(nowX, dotY)
        ctx.lineTo(nowX, botY)
        ctx.lineTo(pastPts[0]!.x, botY)
        ctx.closePath()
        const wash = ctx.createLinearGradient(0, topY, 0, botY)
        wash.addColorStop(0, 'rgb(228 234 242 / 0.15)')
        wash.addColorStop(0.55, 'rgb(212 220 232 / 0.05)')
        wash.addColorStop(1, 'rgb(8 10 13 / 0)')
        ctx.fillStyle = wash
        ctx.fill()

        ctx.beginPath()
        ctx.moveTo(pastPts[0]!.x, pastPts[0]!.y)
        for (let i = 1; i < pastPts.length; i++) ctx.lineTo(pastPts[i]!.x, pastPts[i]!.y)
        ctx.lineTo(nowX, dotY)
        ctx.strokeStyle = 'rgb(235 239 245 / 0.16)'
        ctx.lineWidth = 6
        ctx.stroke()

        ctx.strokeStyle = '#d5dbe3'
        ctx.lineWidth = 2.1
        ctx.stroke()
      }

      // 6. 未来虚线轨迹
      const futurePts = pts.filter(pt => pt.x >= nowX)
      if (futurePts.length > 0) {
        ctx.beginPath()
        ctx.moveTo(nowX, dotY)
        for (const pt of futurePts) ctx.lineTo(pt.x, pt.y)
        ctx.strokeStyle = 'rgb(230 235 242 / 0.28)'
        ctx.lineWidth = 1.25
        ctx.setLineDash([2, 6])
        ctx.stroke()
        ctx.setLineDash([])
      }

      // 7. 渐隐垂直此刻准线
      const lineGrad = ctx.createLinearGradient(0, topY - 24, 0, botY + 24)
      lineGrad.addColorStop(0, 'rgb(241 242 238 / 0)')
      lineGrad.addColorStop(0.25, 'rgb(241 242 238 / 0.18)')
      lineGrad.addColorStop(0.75, 'rgb(241 242 238 / 0.18)')
      lineGrad.addColorStop(1, 'rgb(241 242 238 / 0)')
      ctx.strokeStyle = lineGrad
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(Math.round(nowX) + 0.5, topY - 24)
      ctx.lineTo(Math.round(nowX) + 0.5, botY + 24)
      ctx.stroke()

      // 8. 朱砂此刻落点 + 柔和光晕
      const glow = ctx.createRadialGradient(nowX, dotY, 2, nowX, dotY, 22)
      glow.addColorStop(0, 'rgb(239 82 54 / 0.38)')
      glow.addColorStop(0.5, 'rgb(239 82 54 / 0.1)')
      glow.addColorStop(1, 'rgb(239 82 54 / 0)')
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.arc(nowX, dotY, 22, 0, Math.PI * 2)
      ctx.fill()

      ctx.save()
      ctx.beginPath()
      ctx.arc(nowX, dotY, 10.5, 0, Math.PI * 2)
      ctx.strokeStyle = '#ef5236'
      ctx.globalAlpha = 0.34
      ctx.lineWidth = 1
      ctx.stroke()
      ctx.restore()

      ctx.beginPath()
      ctx.arc(nowX, dotY, 6.5, 0, Math.PI * 2)
      ctx.fillStyle = '#080a0d'
      ctx.fill()

      ctx.beginPath()
      ctx.arc(nowX, dotY, 4.75, 0, Math.PI * 2)
      ctx.fillStyle = '#ef5236'
      ctx.fill()
    }

    const tick = (ms: number): void => {
      if (!document.hidden) render(ms / 1000)
      if (!reduced) raf = requestAnimationFrame(tick)
    }

    resize()
    if (!reduced) raf = requestAnimationFrame(tick)

    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null
    ro?.observe(canvas)

    const onMotion = (): void => {
      reduced = motion?.matches ?? false
      cancelAnimationFrame(raf)
      render(performance.now() / 1000)
      if (!reduced) raf = requestAnimationFrame(tick)
    }
    motion?.addEventListener('change', onMotion)

    const onVis = (): void => {
      if (!document.hidden) render(performance.now() / 1000)
    }
    document.addEventListener('visibilitychange', onVis)

    return () => {
      cancelAnimationFrame(raf)
      ro?.disconnect()
      motion?.removeEventListener('change', onMotion)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])

  return (
    <div className={styles.plate}>
      <div className={styles.plateRule}>
        <span className="t-micro num">01</span>
        <span className="t-micro num">4.5 / 6.5 s</span>
      </div>
      <canvas ref={ref} className={styles.plateCanvas} />
      <div className={styles.plateFoot}>
        <span className="t-micro num">5.5 / min</span>
        <span className="t-micro num">11.0 s</span>
      </div>
    </div>
  )
}
