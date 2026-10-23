import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import {
  cancelResume,
  changeSessionSound,
  pauseForDistress,
  resumeAfterLeadIn,
  savePaceFinderRun,
  startGroundingFromDistress,
  startPractice,
} from '@/app/flows'
import { useResumeCountdown, useSessionSecond, useSessionState } from '@/app/hooks'
import { NavBar, PageFrame, PlayerFrame } from '@/app/layout'
import { PACE_FINDER_RATES, PACE_STEP_SEC } from '@/app/plan'
import { getController } from '@/app/services'
import { CATALOGUE, DETAIL, PACE_FINDER, PLAYER } from '@/content/copy'
import { PRACTICE_BY_ID } from '@/content/practices'
import { CRISIS_CARD } from '@/content/safety'
import { usePrefs } from '@/data'
import type { SessionResult } from '@/engine'
import { type ComfortRating, pickByComfort } from '@/hrv'
import { fmtClock, fmtMinutes } from '@/lib/time'
import {
  Button,
  ChoiceGroup,
  ConfirmDialog,
  Dock,
  Kicker,
  Lead,
  LinkMore,
  Readouts,
  Section,
  Sheet,
  StartBar,
  typeset,
  useToast,
} from '@/ui'
import { DistressSheet } from '@/widgets/DistressSheet'
import { PacedStage } from '@/widgets/SessionStage'
import { SoundPicker } from '@/widgets/SoundPicker'
import { StopGuidance } from '@/widgets/StopGuidance'
import styles from './PaceFinder.module.css'
import { useStrap } from './useStrap'

const practice = PRACTICE_BY_ID['pace-finder']
type View = 'intro' | 'run' | 'result'
const active = (status: string): boolean => ['lead', 'running', 'paused'].includes(status)
export function PaceFinderPage() {
  const state = useSessionState(),
    ctrl = getController(),
    prefs = usePrefs(),
    navigate = useNavigate(),
    toast = useToast(),
    strap = useStrap()
  const heading = useRef<HTMLHeadingElement>(null)
  const inherited = state.plan?.practiceId === 'pace-finder' && active(state.status)
  const [view, setView] = useState<View>(inherited ? 'run' : 'intro'),
    [step, setStep] = useState(inherited ? Math.max(0, Number(state.plan?.params.step ?? 1) - 1) : 0),
    [rating, setRating] = useState(false),
    [choice, setChoice] = useState<number | null>(null),
    [ratings, setRatings] = useState<ComfortRating[]>([]),
    [heartRates, setHeartRates] = useState<(number | undefined)[]>([]),
    [sheet, setSheet] = useState<'sound' | 'distress' | null>(null),
    [endOpen, setEndOpen] = useState(false),
    [saved, setSaved] = useState(false),
    [failed, setFailed] = useState(false)
  useEffect(() => {
    if (view === 'intro' || rating) return
    const frame = requestAnimationFrame(() => heading.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [view, rating])
  const second = useSessionSecond(view === 'run' && active(state.status)),
    resume = useResumeCountdown()
  const results = useRef<SessionResult[]>([]),
    rates = useRef<ComfortRating[]>([]),
    running = useRef(inherited),
    ending = useRef(false),
    stored = useRef<Promise<boolean> | null>(null),
    selected = useRef<number | undefined>(undefined),
    timers = useRef<ReturnType<typeof setTimeout>[]>([]),
    live = useRef(true),
    api = useRef(strap)
  api.current = strap
  const persist = (): Promise<boolean> => {
    if (stored.current) return stored.current
    stored.current = savePaceFinderRun(results.current, {
      ...(selected.current !== undefined ? { chosenRate: selected.current } : {}),
      ...(api.current.combined() ? { hrv: api.current.combined() } : {}),
    })
      .then(record => {
        if (live.current && record) {
          setSaved(true)
          setFailed(false)
        }
        return true
      })
      .catch(() => {
        stored.current = null
        if (live.current) {
          setFailed(true)
          toast.show({ message: PACE_FINDER.saveFailed })
        }
        return false
      })
    return stored.current
  }
  const persistRef = useRef(persist)
  persistRef.current = persist
  useEffect(() => {
    live.current = true
    const off = ctrl.onFinish(result => {
      if (!running.current || result.plan.practiceId !== 'pace-finder' || results.current.includes(result))
        return
      results.current.push(result)
      const metric = api.current.summarize(result)
      if (live.current) setHeartRates(previous => [...previous, metric.meanHr])
      if (live.current && result.completed && !ending.current) {
        setChoice(null)
        setRating(true)
      }
    })
    return () => {
      live.current = false
      queueMicrotask(() => {
        // StrictMode 会重放一次 effect；真正离开页面后才结束并合并记录。
        if (!live.current) {
          for (const timer of timers.current) clearTimeout(timer)
          cancelResume()
          if (
            running.current &&
            ctrl.getState().plan?.practiceId === 'pace-finder' &&
            active(ctrl.getState().status)
          )
            ctrl.end()
          if (running.current) void persistRef.current()
        }
        off()
      })
    }
  }, [ctrl])
  useEffect(() => {
    if (view !== 'run') return
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && !rating && !endOpen && !sheet && state.status !== 'paused') {
        event.preventDefault()
        ctrl.pause()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [view, rating, endOpen, sheet, state.status, ctrl])
  const startStep = (index: number): void => {
    cancelResume()
    api.current.reset()
    setStep(index)
    const outcome = startPractice({
      practiceId: 'pace-finder',
      from: 'pace-finder',
      overrides: { params: { rate: PACE_FINDER_RATES[index]!, step: index + 1 } },
    })
    if (outcome === 'started') {
      running.current = true
      setView('run')
    }
  }
  const start = (): void => {
    results.current = []
    rates.current = []
    api.current.clear()
    stored.current = null
    selected.current = undefined
    ending.current = false
    setRatings([])
    setHeartRates([])
    setSaved(false)
    setFailed(false)
    startStep(0)
  }
  const rate = (ease: number): void => {
    if (choice !== null) return
    setChoice(ease)
    const next = [...rates.current, { rate: PACE_FINDER_RATES[step]!, ease }]
    rates.current = next
    setRatings(next)
    if (step < PACE_FINDER_RATES.length - 1) {
      startStep(step + 1)
      timers.current.push(
        setTimeout(() => {
          setRating(false)
          setChoice(null)
        }, 600),
      )
    } else {
      selected.current = pickByComfort(next) ?? 5.5
      running.current = false
      void persist()
      timers.current.push(
        setTimeout(() => {
          setRating(false)
          setView('result')
        }, 600),
      )
    }
  }
  const stop = (): void => {
    ending.current = true
    cancelResume()
    ctrl.end()
    setEndOpen(false)
    setSheet(null)
    setRating(false)
    void persist().then(ok => {
      if (!ok) return
      running.current = false
      navigate('/practices')
    })
  }
  const chosen = pickByComfort(ratings) ?? 5.5
  const elapsed =
    results.current.reduce((n, r) => n + r.practicedSec, 0) + (active(state.status) ? Math.max(0, second) : 0)
  const strapRow = strap.available && (
    <Section title={PACE_FINDER.strap.label}>
      <p className="t-caption ink-3">{PACE_FINDER.strapInfo.privacy}</p>
      <p className="t-caption ink-3">{PACE_FINDER.strapInfo.reference}</p>
      <div className={styles.strapActions}>
        {strap.device && <span>{strap.device.name}</span>}
        {strap.connecting ? (
          <span role="status">{PACE_FINDER.strapInfo.connecting}</span>
        ) : strap.connected ? (
          <Button variant="secondary" icon="bluetooth" onClick={strap.disconnect}>
            {PACE_FINDER.strapInfo.disconnect}
          </Button>
        ) : (
          <Button
            variant="secondary"
            icon="bluetooth"
            onClick={strap.device ? strap.reconnect : strap.connect}
          >
            {strap.device ? PACE_FINDER.strapInfo.reconnect : PACE_FINDER.strap.connect}
          </Button>
        )}
      </div>
      {strap.error && <p role="status">{strap.error}</p>}
      {strap.device && !strap.connected && <p>{PACE_FINDER.strapInfo.disconnected}</p>}
    </Section>
  )
  if (view === 'run') {
    const paused = state.status === 'paused' && resume === null && !sheet && !endOpen && !rating
    const sound = state.plan?.sound
    return (
      <PlayerFrame name={practice.name} embedded>
        <header data-region="hud" className={styles.hud}>
          <h1 ref={heading} tabIndex={-1} aria-describedby="pace-step">
            {practice.name}
          </h1>
          <p className="t-caption ink-3" id="pace-step">
            {PACE_FINDER.step(step + 1, 5)} · {PACE_FINDER_RATES[step]!.toFixed(1)} {PACE_FINDER.rateUnit}
          </p>
        </header>
        <div data-region="stage" className={styles.stage}>
          <PacedStage
            countdown={resume}
            frozenTime={rating && state.status === 'done' ? PACE_STEP_SEC - 0.001 : undefined}
          />
          {strap.device && (
            <p className="t-caption ink-3" role="status">
              {strap.connected
                ? PACE_FINDER.strapInfo.signal[strap.signal]
                : PACE_FINDER.strapInfo.disconnected}
              {strap.hr !== null && strap.connected ? ` · ${strap.hr} ${PACE_FINDER.heartUnit}` : ''}
            </p>
          )}
          {state.audio === 'blocked' && (
            <Button
              variant="quiet"
              onClick={() => {
                void ctrl.retryAudio?.()
              }}
            >
              {PLAYER.notices.audioRetry}
            </Button>
          )}
        </div>
        <div data-region="readouts">
          <Readouts
            items={[
              { label: PLAYER.readouts.left, value: fmtClock(Math.max(0, 60 - Math.max(0, second))) },
              {
                label: PACE_FINDER.result.columns.rate,
                value: PACE_FINDER_RATES[step]!.toFixed(1),
                unit: PACE_FINDER.rateUnit,
              },
            ]}
          />
        </div>
        <div data-region="controls" className={styles.controls}>
          <Button
            variant="quiet"
            icon="pause"
            aria-disabled={rating}
            onClick={() => {
              if (!rating) {
                cancelResume()
                ctrl.pause()
              }
            }}
          >
            {PLAYER.pause}
          </Button>
          <Button
            variant="quiet"
            icon="sound"
            aria-disabled={rating}
            onClick={() => {
              if (!rating) setSheet('sound')
            }}
          >
            {PLAYER.sound}
          </Button>
          <Button
            variant="quiet"
            icon="end"
            onClick={() => {
              cancelResume()
              ctrl.pause()
              setEndOpen(true)
            }}
          >
            {PLAYER.end}
          </Button>
          <Button
            variant="quiet"
            icon="help"
            aria-label={PLAYER.unwell}
            onClick={() => {
              pauseForDistress()
              setSheet('distress')
            }}
          >
            {PLAYER.unwellShort}
          </Button>
        </div>
        <Sheet
          open={rating}
          onClose={() => {}}
          dismissible={false}
          surface="player"
          title={PACE_FINDER.rating.question}
          footer={
            <Button variant="quiet" onClick={() => setEndOpen(true)}>
              {PLAYER.end}
            </Button>
          }
        >
          <ChoiceGroup
            label={PACE_FINDER.rating.question}
            className={styles.scale}
            value={choice}
            onChange={rate}
            options={[1, 2, 3, 4, 5].map(value => ({
              value,
              label: String(value),
            }))}
          />
          <div className={styles.anchors}>
            <span>{PACE_FINDER.rating.low}</span>
            <span>{PACE_FINDER.rating.high}</span>
          </div>
        </Sheet>
        <Sheet
          open={paused}
          title={PLAYER.paused}
          surface="player"
          onClose={() => resumeAfterLeadIn()}
          closeButton
          footer={
            <Button variant="primary" block onClick={() => resumeAfterLeadIn()}>
              {PLAYER.resume}
            </Button>
          }
        >
          <p>{PACE_FINDER.pauseMeta}</p>
          <StopGuidance ruled helpLink />
        </Sheet>
        <Sheet
          open={sheet === 'sound'}
          onClose={() => setSheet(null)}
          title={PLAYER.sound}
          surface="player"
          closeButton
        >
          {sound && <SoundPicker value={sound} mode="relax" onChange={changeSessionSound} volumes />}
        </Sheet>
        <DistressSheet
          open={sheet === 'distress'}
          onClose={() => setSheet(null)}
          onContinue={() => {
            setSheet(null)
            resumeAfterLeadIn()
          }}
          onEnd={stop}
          onGrounding={() => {
            ending.current = true
            setSheet(null)
            startGroundingFromDistress()
          }}
        />
        <ConfirmDialog
          surface="player"
          open={endOpen}
          title={PLAYER.endDialog.title}
          body={elapsed >= 60 ? PLAYER.endDialog.recorded(fmtMinutes(elapsed)) : PLAYER.endDialog.notRecorded}
          confirmLabel={PLAYER.endDialog.confirm}
          cancelLabel={PLAYER.endDialog.cancel}
          onCancel={() => {
            setEndOpen(false)
            if (!rating) resumeAfterLeadIn()
          }}
          onConfirm={stop}
        />
      </PlayerFrame>
    )
  }
  return (
    <PageFrame title={view === 'result' ? PACE_FINDER.result.title : practice.name} variant="dock">
      <NavBar backTo="/practices" backLabel={CATALOGUE.title} />
      <div className={styles.page}>
        {view === 'intro' ? (
          <>
            <Kicker start={PACE_FINDER.kicker} />
            <h1 tabIndex={-1}>{practice.name}</h1>
            <Lead>
              {practice.description
                .match(/[^。]+。/g)
                ?.slice(0, 2)
                .join('')}
            </Lead>
            <figure className={styles.figure}>
              <svg viewBox="0 0 600 90" role="img" aria-label={DETAIL.figureCaption['pace-finder']}>
                {PACE_FINDER_RATES.map((value, i) => (
                  <g key={value}>
                    <path d={`M${i * 120} ${20 + i * 8}h112`} />
                    <text x={i * 120 + 56} y="80" textAnchor="middle">
                      {value.toFixed(1)}
                    </text>
                  </g>
                ))}
              </svg>
              <figcaption>
                {DETAIL.figure} · {DETAIL.figureCaption['pace-finder']}
              </figcaption>
            </figure>
            <Section title={DETAIL.sections.how}>
              <ol className={styles.steps}>
                {practice.steps.map((line, index) => (
                  <li key={line}>
                    <span className="tnum ink-3">{String(index + 1).padStart(2, '0')}</span>
                    <p>{typeset(line)}</p>
                  </li>
                ))}
              </ol>
            </Section>
            {strapRow}
            <Section title={DETAIL.sections.safety}>
              {practice.safety.map(line => (
                <p key={line}>{typeset(line)}</p>
              ))}
              <LinkMore to="/help">{CRISIS_CARD.title}</LinkMore>
            </Section>
            <Dock>
              <StartBar minutes={7} approx onStart={start} />
            </Dock>
          </>
        ) : (
          <>
            <h1 ref={heading} tabIndex={-1}>
              {PACE_FINDER.result.title}
            </h1>
            <p className={styles.resultRate}>
              <span className="pnum">{chosen.toFixed(1)}</span>
              <span className="t-caption ink-2">{PACE_FINDER.rateUnit}</span>
            </p>
            <p className="ink-2">{typeset(PACE_FINDER.resultNote)}</p>
            <table className={styles.table} aria-label={PACE_FINDER.tableLabel}>
              <thead>
                <tr>
                  <th>{PACE_FINDER.result.columns.rate}</th>
                  <th>{PACE_FINDER.result.columns.ease}</th>
                  {heartRates.some(hr => hr !== undefined) && <th>{PACE_FINDER.result.columns.heartRate}</th>}
                </tr>
              </thead>
              <tbody>
                {ratings.map((item, i) => (
                  <tr key={item.rate} data-chosen={item.rate === chosen}>
                    <th scope="row">
                      <span className="tnum">{item.rate.toFixed(1)}</span>{' '}
                      <span className="t-caption ink-3">{PACE_FINDER.rateUnit}</span>
                    </th>
                    <td aria-label={PACE_FINDER.easeValue.replace('{score}', String(item.ease))}>
                      <span className={styles.dots} aria-hidden="true">
                        {[1, 2, 3, 4, 5].map(n => (
                          <i key={n} data-filled={n <= (item.ease ?? 0)} />
                        ))}
                      </span>
                    </td>
                    {heartRates.some(hr => hr !== undefined) && (
                      <td className="tnum">{heartRates[i]?.toFixed(0) ?? '—'}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {strap.device && <p className="t-caption ink-3">{PACE_FINDER.strapInfo.reference}</p>}
            {saved && <p className="t-caption ink-3">{PACE_FINDER.saved}</p>}
            {failed && (
              <Button variant="secondary" onClick={() => void persist()}>
                {PACE_FINDER.retry}
              </Button>
            )}
            <Dock>
              <div className={styles.resultActions}>
                <Button
                  variant="primary"
                  block
                  onClick={() => {
                    void persist().then(ok => {
                      if (!ok) return
                      prefs.setPractice('slow', { rate: chosen })
                      prefs.set({ personalRate: chosen })
                      toast.show({ message: PACE_FINDER.applied })
                      navigate('/practices/slow')
                    })
                  }}
                >
                  {PACE_FINDER.result.apply}
                </Button>
                <Button
                  variant="quiet"
                  block
                  onClick={() =>
                    void persist().then(ok => {
                      if (ok) navigate('/practices')
                    })
                  }
                >
                  {PACE_FINDER.result.dismiss}
                </Button>
              </div>
            </Dock>
          </>
        )}
      </div>
    </PageFrame>
  )
}
