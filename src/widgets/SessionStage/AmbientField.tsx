import { useEffect, useRef } from 'react'
import styles from './SessionStage.module.css'

interface Ripple {
  born: number
}

/**
 * 引导、专注、计数与声音练习的深潭光晕背景画布：
 * 以极克制的单色月光雾环随自然呼吸节律缓慢吐纳，每次点击「回神」或「数息」向外荡开一道细水纹。
 */
export function AmbientField({ pulse = 0, paused = false }: { pulse?: number; paused?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const ripplesRef = useRef<Ripple[]>([])
  const lastPulseRef = useRef(pulse)
  const pausedRef = useRef(paused)
  pausedRef.current = paused

  useEffect(() => {
    if (pulse > lastPulseRef.current) {
      ripplesRef.current.push({ born: performance.now() })
      if (ripplesRef.current.length > 6) ripplesRef.current.shift()
    }
    lastPulseRef.current = pulse
  }, [pulse])

  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    const ctx = el.getContext('2d')
    if (!ctx) return

    const motion = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null
    let raf = 0
    let w = 0
    let h = 0

    const resize = (): void => {
      const rect = el.getBoundingClientRect()
      const dpr = Math.min(devicePixelRatio || 1, 2)
      w = rect.width
      h = rect.height
      el.width = Math.max(1, Math.round(w * dpr))
      el.height = Math.max(1, Math.round(h * dpr))
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const render = (now: number): void => {
      if (w === 0 || h === 0) return
      ctx.clearRect(0, 0, w, h)
      const cx = w * 0.5
      const cy = h * 0.44
      const minDim = Math.min(w, h)
      const reduced = motion?.matches ?? false

      // 11 秒自然缓呼吸节律（0 → 1 → 0）
      const phase = reduced ? 0.5 : (1 - Math.cos((now / 11000) * Math.PI * 2)) / 2
      const baseR = minDim * (0.28 + phase * 0.08)

      // 深潭中央极克制月光雾晕（单色冷银，非霓虹）
      const aura = ctx.createRadialGradient(cx, cy, 0, cx, cy, baseR * 2.1)
      aura.addColorStop(0, `rgb(220 226 236 / ${0.065 + phase * 0.035})`)
      aura.addColorStop(0.45, `rgb(185 196 212 / ${0.024 + phase * 0.014})`)
      aura.addColorStop(1, 'rgb(8 10 13 / 0)')
      ctx.fillStyle = aura
      ctx.fillRect(0, 0, w, h)

      // 三层极细同心光环，呼吸时微幅张弛
      for (let i = 0; i < 3; i++) {
        const r = baseR * (0.68 + i * 0.34)
        ctx.beginPath()
        ctx.arc(cx, cy, r, 0, Math.PI * 2)
        ctx.strokeStyle = `rgb(235 238 242 / ${0.055 - i * 0.015 + phase * 0.018})`
        ctx.lineWidth = 1
        ctx.stroke()
      }

      // 回神 / 数息触发的物理水波扩散
      if (!reduced && ripplesRef.current.length > 0) {
        const maxR = Math.max(w, h) * 0.58
        const alive: Ripple[] = []
        for (const ripple of ripplesRef.current) {
          const age = (now - ripple.born) / 2400
          if (age >= 1) continue
          alive.push(ripple)
          const eased = 1 - (1 - age) ** 3
          const r = 42 + eased * maxR
          const alpha = (1 - age) ** 2 * 0.24
          ctx.beginPath()
          ctx.arc(cx, cy, r, 0, Math.PI * 2)
          ctx.strokeStyle = `rgb(241 242 238 / ${alpha.toFixed(4)})`
          ctx.lineWidth = 1.25
          ctx.stroke()
        }
        ripplesRef.current = alive
      }
    }

    const tick = (now: number): void => {
      if (!document.hidden && !pausedRef.current) render(now)
      if (!(motion?.matches ?? false)) raf = requestAnimationFrame(tick)
    }

    resize()
    render(performance.now())
    if (!(motion?.matches ?? false)) raf = requestAnimationFrame(tick)

    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null
    ro?.observe(el)
    const onMotion = (): void => {
      cancelAnimationFrame(raf)
      render(performance.now())
      if (!(motion?.matches ?? false)) raf = requestAnimationFrame(tick)
    }
    motion?.addEventListener('change', onMotion)
    return () => {
      cancelAnimationFrame(raf)
      ro?.disconnect()
      motion?.removeEventListener('change', onMotion)
    }
  }, [])

  return (
    <div className={styles.ambient} aria-hidden="true">
      <canvas ref={canvasRef} className={styles.ambientCanvas} />
    </div>
  )
}
