import { useEffect, useRef, useState } from 'react'
import {
  cancelResume,
  changeSessionSound,
  continueAfterDistress,
  endFromDistress,
  pauseForDistress,
  resumeAfterLeadIn,
  setCueVolume,
  startGroundingFromDistress,
  usePendingSession,
} from '@/app/flows'
import { useResumeCountdown, useSessionSecond, useSessionState } from '@/app/hooks'
import { getAudio, getController } from '@/app/services'
import { PLAYER, SETTINGS, TODAY } from '@/content/copy'
import { adjustedDefaults, type CatalogPracticeId, PRACTICE_BY_ID } from '@/content/practices'
import { soundName } from '@/content/sounds'
import { usePrefs } from '@/data'
import { completedCycles } from '@/engine'
import { isIOSDevice } from '@/lib/device'
import { fmtClock, fmtMinutes } from '@/lib/time'
import {
  Button,
  Chip,
  ConfirmDialog,
  cx,
  FocusTimeline,
  Icon,
  Kbd,
  type ReadoutItem,
  Readouts,
  Sheet,
  Slider,
  StackRow,
  StepChart,
  stepSections,
} from '@/ui'
import { DistressSheet } from '@/widgets/DistressSheet'
import { CaptionLine, PacedStage } from '@/widgets/SessionStage'
import { SoundPicker } from '@/widgets/SoundPicker'
import { StartButton } from '@/widgets/StartButton'
import { StopGuidance } from '@/widgets/StopGuidance'
import styles from './Player.module.css'

export interface PlayerPageProps {
  practiceId: CatalogPracticeId
}
export function PlayerPage({ practiceId }: PlayerPageProps) {
  return <Player key={practiceId} practiceId={practiceId} />
}
const taught = new Set<string>()

function Player({ practiceId }: PlayerPageProps) {
  const state = useSessionState()
  const phase = usePendingSession(s => s.phase)
  const second = useSessionSecond(state.status === 'lead' || state.status === 'running')
  const countdown = useResumeCountdown()
  const [sheet, setSheet] = useState<'distress' | 'end' | 'sound' | null>(null)
  const [skipped, setSkipped] = useState<string[]>([])
  const [skipLocked, setSkipLocked] = useState(false)
  const skipTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [lastInteraction, setLastInteraction] = useState(0)
  const [howTo] = useState(() => !taught.has(practiceId))
  const prefs = usePrefs()
  const practice = PRACTICE_BY_ID[practiceId]
  const ctrl = getController()
  const plan = state.plan
  const timeline = state.timeline ?? plan?.timeline
  const time = Math.max(0, second)
  const remaining = state.endSec === null ? null : Math.max(0, state.endSec - time)
  const active = state.status === 'lead' || state.status === 'running' || state.status === 'paused'
  const lead = countdown ?? (state.status === 'lead' ? Math.max(0, -second) : null)
  const pauseOpen = state.status === 'paused' && sheet === null && countdown === null
  const sounds = plan
    ? [plan.sound.ambience, plan.sound.music]
        .filter(id => id !== 'none')
        .map(soundName)
        .join(' + ') || soundName('none')
    : ''
  const soundMode = plan?.sound.mode ?? 'relax'
  const resume = (): void => {
    setSheet(null)
    resumeAfterLeadIn()
  }
  const pause = (): void => {
    cancelResume()
    ctrl.pause()
  }
  const distress = (): void => {
    pauseForDistress()
    setSheet('distress')
  }
  const end = (): void => {
    cancelResume()
    if (state.status === 'lead') ctrl.end()
    else {
      ctrl.pause()
      setSheet('end')
    }
  }
  useEffect(() => {
    taught.add(practiceId)
    return () => {
      if (skipTimer.current) clearTimeout(skipTimer.current)
    }
  }, [practiceId])
  useEffect(() => {
    const keys = (event: KeyboardEvent): void => {
      if (sheet !== null || !active || event.repeat) return
      if (event.key === 'Escape' && state.status !== 'paused') {
        event.preventDefault()
        event.stopImmediatePropagation()
        pause()
        return
      }
      if (event.code === 'Space' || event.key === ' ') {
        if (state.status === 'paused') {
          event.preventDefault()
          event.stopImmediatePropagation()
          resume()
        } else if (practice.kind === 'focus' && state.status === 'running') {
          event.preventDefault()
          event.stopImmediatePropagation()
          ctrl.mark()
        }
        return
      }
      if (practice.kind !== 'count' || state.status !== 'running') return
      const kind = ['f', 'F', 'ArrowLeft'].includes(event.key)
        ? 'breath'
        : ['j', 'J', 'ArrowRight'].includes(event.key)
          ? 'ninth'
          : event.key === 'Backspace'
            ? 'reset'
            : null
      if (kind) {
        event.preventDefault()
        ctrl.countTap(kind)
      }
    }
    document.addEventListener('keydown', keys, true)
    return () => document.removeEventListener('keydown', keys, true)
  })
  const readouts: ReadoutItem[] = [
    { label: PLAYER.readouts.left, value: remaining === null ? PLAYER.unlimited : fmtClock(remaining) },
  ]
  if (plan?.pattern) {
    readouts.push(
      plan.pattern.type === 'phases'
        ? {
            label: PLAYER.readouts.step,
            value: String(plan.pattern.segs[0]?.dur ?? 4),
            unit: PLAYER.units.seconds,
          }
        : {
            label: PLAYER.readouts.rate,
            value: (state.rate ?? plan.pattern.rate).toFixed(1),
            unit: PLAYER.units.rate,
          },
    )
    const point = ctrl.breathAt(time)
    readouts.push({
      label: PLAYER.readouts.rounds,
      value: String(point ? point.cycle + 1 : completedCycles(plan.pattern, time)),
    })
  } else if (practice.kind === 'guided' && practiceId !== 'grounding') {
    const section = timeline?.sections.find(s => s.id === state.section?.id)
    const next = timeline?.sections[(state.section?.index ?? -1) + 1]
    readouts.push(
      { label: PLAYER.guided.sectionLeft, value: section ? fmtClock(Math.max(0, section.t1 - time)) : '—' },
      { label: PLAYER.readouts.next, value: next?.title ?? '—', text: true },
    )
  } else if (practice.kind === 'timer') {
    const interval = plan?.intervalSec
    const next = interval ? (Math.floor(time / interval) + 1) * interval : null
    readouts.splice(
      0,
      1,
      { label: PLAYER.readouts.sat, value: fmtClock(time) },
      {
        label: PLAYER.readouts.nextBell,
        value: next !== null && (state.endSec === null || next < state.endSec) ? fmtClock(next - time) : '—',
      },
    )
  } else if (practice.kind === 'sound')
    readouts.push({ label: PLAYER.sound, value: sounds ?? '', text: true })
  if (!active && phase === 'idle')
    return (
      <>
        <header data-region="hud" className={styles.hud}>
          <h1 className="vh" tabIndex={-1}>
            {practice.name}
          </h1>
          <p className={styles.name}>{practice.name}</p>
        </header>
        <div data-region="stage" className={styles.idle}>
          <p className="ink-2">{practice.short}</p>
          <StartButton practiceId={practiceId} from="player" />
        </div>
      </>
    )
  return (
    <>
      <header data-region="hud" className={styles.hud}>
        <div>
          <p className={styles.name}>{practice.name}</p>
          <p className="t-caption ink-3">
            {plan?.plannedSec ? TODAY.minutes(plan.plannedSec / 60) : PLAYER.unlimited} · {sounds}
            {state.status === 'paused' ? ` · ${PLAYER.paused}` : ''}
          </p>
        </div>
        <Chip variant="unwell" className={styles.hudUnwell} onClick={distress}>
          {PLAYER.unwell}
        </Chip>
      </header>
      {(practice.kind !== 'guided' || practiceId === 'grounding' || lead !== null) && (
        <h1 className="vh" tabIndex={-1}>
          {practice.name}
        </h1>
      )}
      {howTo && time < 8 && practice.kind === 'guided' && practiceId !== 'grounding' && (
        <p className="t-caption ink-3">
          {adjustedDefaults(practiceId, prefs.safety.screening).eyesOpen
            ? PLAYER.guided.howTo.eyesOpen
            : PLAYER.guided.howTo.closable}
        </p>
      )}
      {time < 8 && !('wakeLock' in navigator) && (
        <p className="t-caption ink-3">{PLAYER.notices.awakeUnsupported}</p>
      )}
      {practiceId === 'sleep' && isIOSDevice() && time < 8 && (
        <p className="t-caption ink-3">{PLAYER.notices.iosLock}</p>
      )}
      {state.audio === 'blocked' && (
        <div className={styles.notice} role="status">
          {PLAYER.notices.audioBlocked}
          <Button
            variant="quiet"
            onClick={() => {
              void (ctrl.retryAudio?.() ?? getAudio().unlock())
            }}
          >
            {PLAYER.notices.audioRetry}
          </Button>
        </div>
      )}
      <div
        data-region="stage"
        className={cx(
          styles.stage,
          practice.kind === 'focus' && styles.focusStage,
          practiceId === 'sleep' && time - lastInteraction >= 30 && styles.sleepDim,
        )}
        onPointerDown={() => setLastInteraction(time)}
        onPointerUp={event => {
          if (
            practice.kind === 'focus' &&
            !sheet &&
            state.status === 'running' &&
            !(event.target as HTMLElement).closest('a,button')
          )
            ctrl.mark()
        }}
      >
        {plan?.pattern ? (
          <PacedStage countdown={countdown} hurry={practiceId === 'slow'} />
        ) : lead !== null ? (
          <div>
            <p className="t-caption ink-3">{PLAYER.leadIn}</p>
            <p className="t-count">{lead}</p>
          </div>
        ) : practice.kind === 'focus' ? (
          <>
            <FocusTimeline
              minutes={(state.endSec ?? plan?.plannedSec ?? 600) / 60}
              marks={state.marks}
              t={time}
            />
            <CaptionLine caption={state.caption} second={second} className={styles.focusCaption} />
            <button
              type="button"
              className={styles.focusKey}
              aria-describedby="mark-help"
              onClick={() => ctrl.mark()}
            >
              <span>{PLAYER.focus.mark}</span>
              <span className="t-caption ink-3" data-modality="touch">
                {PLAYER.focus.markHintTouch}
              </span>
              <span className="t-caption ink-3" data-modality="fine">
                {PLAYER.focus.markHintKeys} <Kbd>{PLAYER.focus.markKey}</Kbd>
              </span>
            </button>
            <p className="vh" id="mark-help">
              {PLAYER.focus.markHelp}
            </p>
          </>
        ) : practice.kind === 'count' ? (
          <>
            {(state.count?.cycles ?? 0) < 2 && <p className="t-caption ink-3">{PLAYER.count.hint}</p>}
            <div className={styles.countPad}>
              {(['breath', 'ninth'] as const).map(kind => (
                <button key={kind} type="button" onClick={() => ctrl.countTap(kind)}>
                  <span>{PLAYER.count[kind]}</span>
                  <span className="t-caption ink-3">
                    {PLAYER.count[kind === 'breath' ? 'breathCaption' : 'ninthCaption']}
                  </span>
                </button>
              ))}
            </div>
            <Button variant="secondary" block onClick={() => ctrl.countTap('reset')}>
              {PLAYER.count.reset}
            </Button>
            <p data-modality="fine" className="t-caption ink-3">
              {PLAYER.count.keys}
            </p>
          </>
        ) : practice.kind === 'guided' ? (
          <>
            {practiceId === 'grounding' ? (
              <p className="t-count">{Math.ceil(remaining ?? 0)}</p>
            ) : (
              <>
                <div className={styles.where}>
                  <div>
                    <p className="t-caption ink-3">
                      {state.section?.skippable
                        ? PLAYER.guided.where(state.section.index + 1, timeline?.sections.length ?? 1)
                        : PLAYER.guided.now(state.section?.title ?? PLAYER.leadIn)}
                    </p>
                    <h1 tabIndex={-1}>{state.section?.title ?? practice.name}</h1>
                  </div>
                  {state.section?.skippable && (
                    <Chip
                      icon="skip"
                      aria-describedby="skip-help"
                      aria-disabled={skipLocked}
                      onClick={() => {
                        if (skipLocked) return
                        setSkipped(previous => [...previous, state.section!.id])
                        ctrl.skipSection()
                        setSkipLocked(true)
                        skipTimer.current = setTimeout(() => setSkipLocked(false), 300)
                      }}
                    >
                      {PLAYER.guided.skip}
                    </Chip>
                  )}
                </div>
                <p className="vh" id="skip-help">
                  {PLAYER.guided.skipHelp}
                </p>
                {timeline && (
                  <StepChart
                    sections={stepSections(timeline, TODAY.start)}
                    duration={state.endSec ?? plan?.plannedSec ?? 60}
                    now={time}
                    skipped={skipped}
                    step={practiceId === 'body-scan' ? 6 : 0}
                    name={practice.name}
                  />
                )}
              </>
            )}
            <CaptionLine caption={state.caption} second={second} className={styles.guidedCaption} />
          </>
        ) : practice.kind === 'timer' ? (
          <>
            <p className="t-count">{fmtClock(remaining ?? time)}</p>
            <ProgressLine time={time} duration={state.endSec ?? 0} interval={plan?.intervalSec} />
            <p className="t-caption ink-3">
              {plan?.intervalSec
                ? SETTINGS.sound.interval.every(plan.intervalSec / 60)
                : SETTINGS.sound.interval.off}
            </p>
          </>
        ) : (
          <>
            <p className="t-caption ink-3">{SETTINGS.sound.mode[soundMode]}</p>
            <h2 className="t-title">{sounds}</h2>
            <p className="t-timer">{remaining === null ? PLAYER.unlimited : fmtClock(remaining)}</p>
            <ProgressLine time={time} duration={state.endSec ?? 0} fade={soundMode === 'sleep' ? 120 : 60} />
          </>
        )}
        {state.silentEnding && (
          <p className="t-caption ink-3">
            {plan?.bells === false || plan?.endBell === false
              ? PLAYER.silentEndingNoBell
              : PLAYER.silentEnding}
          </p>
        )}
      </div>
      <div data-region="readouts">
        <Readouts items={readouts} />
      </div>
      <nav data-region="controls" className={styles.controls} aria-label={PLAYER.controls}>
        <button type="button" onClick={state.status === 'paused' ? resume : pause}>
          <Icon name={state.status === 'paused' ? 'play' : 'pause'} />
          {state.status === 'paused' ? PLAYER.resume : PLAYER.pause}
        </button>
        <button type="button" aria-haspopup="dialog" onClick={() => setSheet('sound')}>
          <Icon name="sound" />
          {PLAYER.sound}
        </button>
        <button
          type="button"
          aria-label={PLAYER.unwell}
          aria-haspopup="dialog"
          className={styles.controlUnwell}
          onClick={distress}
        >
          <Icon name="help" />
          {PLAYER.unwellShort}
        </button>
        <button type="button" aria-haspopup={state.status === 'lead' ? undefined : 'dialog'} onClick={end}>
          <Icon name="end" />
          {PLAYER.end}
        </button>
      </nav>
      <Sheet
        open={pauseOpen}
        onClose={resume}
        title={PLAYER.paused}
        surface="player"
        size="full"
        footer={
          <>
            <Button variant="primary" block onClick={resume}>
              {PLAYER.resume}
            </Button>
            <Button variant="secondary" block onClick={end}>
              {PLAYER.end}
            </Button>
          </>
        }
      >
        <p className="t-caption ink-3">
          {PLAYER.pausePanel.meta(
            fmtClock(time),
            remaining === null ? PLAYER.unlimited : fmtClock(remaining),
          )}
        </p>
        <StopGuidance ruled helpLink keys={PLAYER.pausePanel.keys} />
      </Sheet>
      <DistressSheet
        open={sheet === 'distress'}
        onClose={() => setSheet(null)}
        onContinue={() => {
          setSheet(null)
          continueAfterDistress()
        }}
        onEnd={() => {
          setSheet(null)
          endFromDistress()
        }}
        onGrounding={
          practiceId === 'grounding'
            ? null
            : () => {
                setSheet(null)
                startGroundingFromDistress()
              }
        }
      />
      <Sheet
        open={sheet === 'sound'}
        onClose={() => setSheet(null)}
        title={PLAYER.sound}
        surface="player"
        closeButton
      >
        {plan && <SoundPicker mode={soundMode} value={plan.sound} onChange={changeSessionSound} volumes />}
        <StackRow label={SETTINGS.sound.volume.cues} value={`${prefs.volume.cues}%`}>
          {({ labelId }) => (
            <Slider
              min={0}
              max={100}
              step={5}
              value={prefs.volume.cues}
              onChange={setCueVolume}
              labelledBy={labelId}
            />
          )}
        </StackRow>
      </Sheet>
      <div data-theme="dark" data-surface="player">
        <ConfirmDialog
          surface="player"
          open={sheet === 'end'}
          title={PLAYER.endDialog.title}
          body={time >= 60 ? PLAYER.endDialog.recorded(fmtMinutes(time)) : PLAYER.endDialog.notRecorded}
          cancelLabel={PLAYER.endDialog.cancel}
          confirmLabel={PLAYER.endDialog.confirm}
          onCancel={resume}
          onConfirm={() => {
            setSheet(null)
            ctrl.end()
          }}
        />
      </div>
    </>
  )
}

function ProgressLine({
  time,
  duration,
  interval,
  fade,
}: {
  time: number
  duration: number
  interval?: number | null
  fade?: number
}) {
  const now = duration > 0 ? Math.min(1, time / duration) : 0
  return (
    <svg viewBox="0 0 350 64" className={styles.progress} aria-hidden="true">
      <path className={styles.track} d="M0 48H350" />
      {fade ? (
        <path
          className={styles.trace}
          d={duration > 0 ? `M0 12H${350 * Math.max(0, 1 - fade / duration)}L350 48` : 'M0 12H350'}
        />
      ) : (
        <path className={styles.trace} d={`M0 48H${350 * now}`} />
      )}
      {interval && duration > 0
        ? Array.from({ length: Math.ceil(duration / interval) - 1 }, (_, i) => (i + 1) * interval).map(t => (
            <path
              key={t}
              className={t <= time ? styles.trace : styles.track}
              d={`M${(t / duration) * 350} 42v6`}
            />
          ))
        : null}
      <circle
        className={styles.dot}
        cx={now * 350}
        cy={
          fade
            ? duration > 0 && time > duration - fade
              ? 12 + ((time - duration + fade) / fade) * 36
              : 12
            : 48
        }
        r="4"
      />
    </svg>
  )
}
