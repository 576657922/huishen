import { useMemo, useState } from 'react'
import { useParams } from 'react-router'
import { type StartOptions, startPractice } from '@/app/flows'
import { NavBar, PageFrame } from '@/app/layout'
import { NotFound } from '@/app/pages/NotFound'
import { CATALOGUE, PROGRAM, RECORDS, TODAY } from '@/content/copy'
import { adjustedDefaults, isCatalogPracticeId, PRACTICE_BY_ID } from '@/content/practices'
import { PROGRAMS } from '@/content/programs'
import { CRISIS_CARD } from '@/content/safety'
import { programDay, recommend, type TodayPick } from '@/content/today'
import type { Program as ProgramContent, ProgramId } from '@/content/types'
import { nextProgramDay, type ProgramProgress, usePrefs, useRecords, useToday } from '@/data'
import { dayKey, parseDayKey, startOfWeek } from '@/lib/date'
import {
  Button,
  ButtonLink,
  ConfirmDialog,
  Disclosure,
  DisclosureRow,
  Dock,
  Icon,
  Kicker,
  Lead,
  LinkMore,
  NavRow,
  PracticeList,
  PracticeRow,
  Reveal,
  ScaleGroup,
  Section,
  Segmented,
  Sheet,
  typeset,
  useToast,
} from '@/ui'
import { StartButton } from '@/widgets/StartButton'
import styles from './Program.module.css'

const isProgramId = (id: string): id is ProgramId => Object.hasOwn(PROGRAMS, id)
export function ProgramPage() {
  const { id = '' } = useParams()
  if (!isProgramId(id)) return <NotFound />
  return <ProgramDetail key={id} program={PROGRAMS[id]} />
}
function optionsFor(pick: TodayPick): StartOptions | null {
  return isCatalogPracticeId(pick.practiceId)
    ? {
        practiceId: pick.practiceId,
        minutes: pick.minutes,
        from: 'program',
        ...(pick.params ? { overrides: { params: pick.params } } : {}),
        ...(pick.plan ? { programDay: pick.plan } : {}),
      }
    : null
}
function Progress({ program, progress }: { program: ProgramContent; progress: ProgramProgress | undefined }) {
  const next = nextProgramDay(progress, program.weeks.length)
  const done = new Set(progress?.done ?? [])
  return (
    <svg
      className={styles.progress}
      width={program.weeks.length * 32 + 32}
      height="48"
      viewBox={`0 0 ${program.weeks.length * 32 + 32} 48`}
      role="img"
      aria-label={next ? TODAY.program.day(program.title, next.week, next.day) : PROGRAM.finished}
    >
      {program.weeks.map(week => {
        const complete = Array.from({ length: 7 }, (_, i) => done.has(`w${week.week}d${i + 1}`)).every(
          Boolean,
        )
        const current = Boolean(progress && next?.week === week.week)
        return (
          <g key={week.week}>
            <rect
              x={(week.week - 1) * 32 + 17}
              y="1"
              width="24"
              height="24"
              className={complete ? styles.completeWeek : current ? styles.currentWeek : styles.futureWeek}
            />
            {current &&
              Array.from({ length: 7 }, (_, i) => i + 1)
                .filter(day => done.has(`w${week.week}d${day}`))
                .map(day => (
                  <circle
                    key={day}
                    className={styles.day}
                    cx={(week.week - 1) * 32 + 29 + (day - 4) * 8}
                    cy="38"
                    r="3"
                  />
                ))}
          </g>
        )
      })}
    </svg>
  )
}
function ProgramDetail({ program }: { program: ProgramContent }) {
  const prefs = usePrefs()
  const today = useToday()
  const now = useMemo(() => parseDayKey(today), [today])
  const { records } = useRecords()
  const toast = useToast()
  const progress = prefs.programs[program.id]
  const state = { programId: program.id, done: progress?.done ?? [] }
  const day = programDay(state, now)
  const finished = Boolean(progress && !day)
  const currentWeek = day?.week ?? program.weeks.length
  const [viewedWeek, setViewedWeek] = useState<number | null>(null)
  const week = program.weeks[(viewedWeek ?? currentWeek) - 1] ?? program.weeks[0]!
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [dialog, setDialog] = useState<'leave' | 'restart' | null>(null)
  const [stressOpen, setStressOpen] = useState(false)
  const [variant, setVariant] = useState<'day' | 'short' | 'long'>('day')
  const recommended = recommend({
    now,
    program: state,
    lastPracticeAt: null,
    screening: prefs.safety.screening,
  })
  const picks = [recommended, ...recommended.alternatives].filter(p => p.plan?.programId === program.id)
  const normal = picks.find(p => p.plan?.role === 'day')
  const short = picks.find(p => p.plan?.role === 'short')
  const normalPractice =
    normal && isCatalogPracticeId(normal.practiceId) ? PRACTICE_BY_ID[normal.practiceId] : null
  const longAllowed =
    normal &&
    normalPractice &&
    program.id === 'mindfulness-8w' &&
    adjustedDefaults(normalPractice.id, prefs.safety.screening).durations.includes(20)
  const paired =
    program.id === 'mindfulness-8w' && day?.week === 7 && normal?.practiceId === 'self-compassion'
  const firstDone =
    paired &&
    records.some(
      r =>
        r.params.program === program.id &&
        r.params.programDay === day?.key &&
        r.date >= (progress?.startedOn ?? today) &&
        r.practiceId === 'focus' &&
        r.completed &&
        r.actualSec >= 300,
    )
  const pairFirst: TodayPick | undefined =
    paired && normal
      ? {
          ...normal,
          practiceId: 'focus',
          minutes: 5,
          plan: normal.plan ? { ...normal.plan, countsAsDay: false } : undefined,
        }
      : undefined
  const main = paired && !firstDone ? pairFirst : normal
  const pairShort: TodayPick | undefined =
    paired && normal?.plan ? { ...normal, plan: { ...normal.plan, role: 'short' } } : undefined
  const displayedPicks =
    paired && main
      ? [
          main,
          ...(!firstDone && pairShort ? [pairShort] : []),
          ...picks.filter(p => !['focus', 'self-compassion'].includes(p.practiceId)),
        ]
      : picks
  const selected =
    variant === 'short'
      ? (short ?? pairShort ?? normal)
      : variant === 'long' && longAllowed
        ? { ...normal, minutes: 20 }
        : main
  const selectedOptions = selected ? optionsFor(selected) : null
  const paragraphs = program.summary.match(/[^。]+。/g) ?? [program.summary]
  const rest = paragraphs.slice(2).join('')
  const monday = dayKey(startOfWeek(now))
  const answered = prefs.stressRatings.some(r => r.date >= monday && r.date <= today)
  const stressPrompt =
    prefs.weeklyStress &&
    program.id === 'mindfulness-8w' &&
    (!progress || progress.done.length === 0 || currentWeek === 4 || currentWeek === 8)
  const join = (): void => {
    prefs.startProgram(program.id)
    setViewedWeek(null)
    setVariant('day')
  }
  const launch = (pick: TodayPick): void => {
    const opts = optionsFor(pick)
    if (opts) startPractice(opts)
  }
  return (
    <PageFrame title={program.title} variant="dock">
      <NavBar backTo="/practices" backLabel={CATALOGUE.title} />
      <Kicker start={PROGRAM.kicker(program.weeks.length)} />
      <h1 tabIndex={-1}>{program.title}</h1>
      <div className={styles.layout}>
        <div className={styles.intro}>
          <Lead>{paragraphs.slice(0, 2).join('')}</Lead>
          {rest && (
            <>
              <Disclosure
                expanded={summaryOpen}
                controls="program-summary"
                onToggle={() => setSummaryOpen(v => !v)}
              >
                {summaryOpen ? RECORDS.hide : PROGRAM.more}
              </Disclosure>
              <Reveal expanded={summaryOpen} id="program-summary">
                <p className="ink-2">{typeset(rest)}</p>
              </Reveal>
            </>
          )}
          <p className="t-caption ink-3">
            {finished ? PROGRAM.finished : progress ? PROGRAM.joined : CATALOGUE.programs.aside}
          </p>
          {progress && day && (
            <Section title={PROGRAM.choose} className={styles.choice}>
              <Segmented
                label={PROGRAM.choose}
                value={variant}
                onChange={setVariant}
                options={[
                  { value: 'day', label: PROGRAM.main },
                  ...(short || paired ? [{ value: 'short' as const, label: PROGRAM.roles.short }] : []),
                  ...(longAllowed ? [{ value: 'long' as const, label: PROGRAM.long }] : []),
                ]}
              />
              {paired && <p className="t-caption ink-2">{firstDone ? PROGRAM.second : PROGRAM.paired}</p>}
            </Section>
          )}
          {progress && day && (
            <p className="t-caption ink-3">{TODAY.program.day(program.title, day.week, day.day)}</p>
          )}
          <LinkMore to="/help" className={styles.help}>
            {CRISIS_CARD.title}
          </LinkMore>
          <Dock className={styles.dock}>
            {!progress ? (
              <Button variant="primary" block onClick={join}>
                {PROGRAM.join}
              </Button>
            ) : finished ? (
              <Button variant="primary" block onClick={() => setDialog('restart')}>
                {PROGRAM.restart.label}
              </Button>
            ) : selectedOptions?.practiceId === 'pace-finder' ? (
              <ButtonLink variant="primary" to="/pace-finder">
                {PRACTICE_BY_ID['pace-finder'].name}
              </ButtonLink>
            ) : (
              selectedOptions && <StartButton {...selectedOptions} />
            )}
          </Dock>
        </div>
        <div className={styles.content}>
          <Progress program={program} progress={progress} />
          <Section
            className={styles.thisWeek}
            title={PROGRAM.week(week.week, week.title)}
            aside={PROGRAM.readingTime}
          >
            <p className="ink-2">{typeset(week.theme)}</p>
            <DisclosureRow
              key={`${week.week}-${Boolean(progress)}-${Boolean(day?.firstDayOfWeek)}`}
              label={PROGRAM.reading}
              defaultExpanded={Boolean(day?.firstDayOfWeek && progress && week.week === currentWeek)}
            >
              <div className={styles.reading}>
                {week.reading.split('\n\n').map(paragraph => (
                  <p key={paragraph}>{typeset(paragraph)}</p>
                ))}
              </div>
            </DisclosureRow>
            {week.week === currentWeek && day && <p className={styles.tip}>{typeset(day.tip)}</p>}
            {week.week === currentWeek && day && (
              <PracticeList className={styles.practices}>
                {displayedPicks.map(pick => {
                  if (!isCatalogPracticeId(pick.practiceId)) return null
                  const practice = PRACTICE_BY_ID[pick.practiceId]
                  return (
                    <PracticeRow
                      key={`${pick.practiceId}-${pick.minutes}-${pick.plan?.role}`}
                      practice={practice}
                      description={
                        pick.plan?.role === 'day'
                          ? PROGRAM.main
                          : PROGRAM.roles[pick.plan?.role === 'short' ? 'short' : 'extra']
                      }
                      minutes={pick.minutes}
                      {...(!progress
                        ? { to: `/practices/${practice.id}` }
                        : practice.id === 'pace-finder'
                          ? { to: '/pace-finder' }
                          : { onClick: () => launch(pick) })}
                    />
                  )
                })}
              </PracticeList>
            )}
          </Section>
          {stressPrompt && (
            <NavRow
              className={styles.stressPrompt}
              label={RECORDS.weeklyStress.prompt}
              hint={RECORDS.weeklyStress.rowHint}
              value={answered ? RECORDS.weeklyStress.answered : undefined}
              onClick={() => {
                if (!answered) setStressOpen(true)
              }}
              opensDialog={!answered}
            />
          )}
          <Section className={styles.allWeeks} title={PROGRAM.allWeeks(program.weeks.length)}>
            <ol className={styles.weeks}>
              {program.weeks.map(w => {
                const complete = Array.from({ length: 7 }, (_, i) =>
                  progress?.done.includes(`w${w.week}d${i + 1}`),
                ).every(Boolean)
                return (
                  <li key={w.week}>
                    <button
                      type="button"
                      aria-current={progress && w.week === currentWeek && !finished ? 'step' : undefined}
                      onClick={() => setViewedWeek(w.week)}
                    >
                      <span className="tnum ink-3">{String(w.week).padStart(2, '0')}</span>
                      <span>
                        <strong>{w.title}</strong>
                        <span className="t-caption ink-2">{w.theme}</span>
                      </span>
                      {complete ? (
                        <Icon name="check" size={16} />
                      ) : progress && w.week === currentWeek && !finished ? (
                        <span className="t-caption ink-3">{PROGRAM.current}</span>
                      ) : null}
                    </button>
                  </li>
                )
              })}
            </ol>
          </Section>
          {progress && (
            <div className={styles.management}>
              <Button variant="quiet" onClick={() => setDialog('restart')}>
                {PROGRAM.restart.label}
              </Button>
              <Button variant="quiet" onClick={() => setDialog('leave')}>
                {PROGRAM.leave}
              </Button>
            </div>
          )}
        </div>
      </div>
      <ConfirmDialog
        open={dialog !== null}
        title={dialog === 'leave' ? PROGRAM.leaveDialog.title : PROGRAM.restart.title}
        body={dialog === 'leave' ? PROGRAM.leaveDialog.body : PROGRAM.restart.body}
        confirmLabel={dialog === 'leave' ? PROGRAM.leaveDialog.confirm : PROGRAM.restart.confirm}
        cancelLabel={PROGRAM.restart.cancel}
        onCancel={() => setDialog(null)}
        onConfirm={() => {
          if (dialog === 'leave') prefs.leaveProgram(program.id)
          else join()
          setDialog(null)
        }}
      />
      <Sheet
        open={stressOpen}
        onClose={() => setStressOpen(false)}
        title={RECORDS.weeklyStress.question}
        headAction={
          <Button variant="quiet" onClick={() => setStressOpen(false)}>
            {RECORDS.weeklyStress.skip}
          </Button>
        }
      >
        <ScaleGroup
          min={1}
          max={5}
          label={RECORDS.weeklyStress.question}
          value={null}
          onChange={score => {
            prefs.addStressRating(score)
            setStressOpen(false)
            toast.show({ message: RECORDS.weeklyStress.saved })
          }}
          anchors={{ low: RECORDS.weeklyStress.low, high: RECORDS.weeklyStress.high }}
        />
      </Sheet>
    </PageFrame>
  )
}
