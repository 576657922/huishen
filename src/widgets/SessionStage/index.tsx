import { useEffect, useState } from 'react'
import { useSessionSecond, useSessionState } from '@/app/hooks'
import { getController } from '@/app/services'
import { PLAYER } from '@/content/copy'
import type { Caption } from '@/engine'
import { Chip, clauses, cx } from '@/ui'
import { BreathCanvas } from './Canvas'
import styles from './SessionStage.module.css'

export { BreathCanvas } from './Canvas'
export function CaptionLine({
  caption,
  second,
  className,
}: {
  caption: Caption | null
  second: number
  className?: string
}) {
  return (
    <p
      className={cx(styles.caption, caption && second > caption.t + caption.dur + 6 && styles.dim, className)}
      aria-live="polite"
      aria-atomic="true"
    >
      <span key={caption?.t}>{caption ? clauses(caption.text) : '\u00a0'}</span>
    </p>
  )
}
/** 播放器与舒适节律探索共用同一个节拍舞台。 */
export function PacedStage({
  countdown,
  hurry = false,
  frozenTime,
}: {
  countdown?: number | null
  hurry?: boolean
  frozenTime?: number
}) {
  const state = useSessionState()
  const second = useSessionSecond(state.status === 'running' || state.status === 'lead')
  const point = getController().breathAt(Math.max(0, frozenTime ?? getController().time()))
  const plan = state.plan
  const [request, setRequest] = useState<{ rate: number; at: number } | null>(null)
  const [hint, setHint] = useState(false)
  useEffect(() => {
    if (!hint) return
    const timer = setTimeout(() => setHint(false), 3000)
    return () => clearTimeout(timer)
  }, [hint])
  const lead = countdown ?? (state.status === 'lead' ? Math.max(0, -second) : null)
  const active = lead !== null || point !== null
  const next =
    point?.seg && plan?.pattern ? plan.pattern.segs[(point.idx + 1) % plan.pattern.segs.length] : null
  const maxed = request?.rate === 7 || state.rate === 7
  const pending = request !== null && state.rate !== request.rate && second <= request.at + 20
  return (
    <>
      {active && (
        <>
          <div className={styles.phaseRow}>
            <p key={lead !== null ? 'lead' : point?.seg?.key} className={styles.phase}>
              {lead !== null ? PLAYER.leadIn : point?.seg?.label}
            </p>
            <p className={styles.next}>
              {lead !== null ? (
                <span className="t-count">{lead}</span>
              ) : (
                PLAYER.paced.next
                  .replace('{seconds}', String(Math.ceil(point?.rem ?? 0)))
                  .replace('{phase}', next ? PLAYER.paced.phaseActions[next.key] : '')
              )}
            </p>
          </div>
          <BreathCanvas box={plan?.pattern?.type === 'phases'} frozenTime={frozenTime} />
          {hurry && lead === null && (
            <div className={styles.hurry}>
              <span className="t-caption ink-3">
                {maxed
                  ? PLAYER.paced.hurryMax(7)
                  : hint && request
                    ? PLAYER.paced.hurried(request.rate)
                    : PLAYER.paced.hurryHint}
              </span>
              <Chip
                variant="quiet"
                aria-describedby="hurry-help"
                aria-disabled={maxed || pending || state.status !== 'running'}
                onClick={() => {
                  if (maxed || pending || state.status !== 'running') return
                  const rate = Math.min(7, (state.rate ?? 5.5) + 0.5)
                  getController().stepBack()
                  setRequest({ rate, at: second })
                  setHint(true)
                }}
              >
                {PLAYER.paced.hurry}
              </Chip>
              <span id="hurry-help" className="vh">
                {PLAYER.paced.hurryHelp}
              </span>
            </div>
          )}
          {plan?.pattern?.type === 'sigh' && <p className="t-caption ink-3">{PLAYER.paced.selfPaced}</p>}
        </>
      )}
      <CaptionLine caption={state.caption} second={second} />
    </>
  )
}
