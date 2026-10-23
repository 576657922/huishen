import { useMemo, useState } from 'react'
import { type StartSource, startPractice } from '@/app/flows'
import { Dateline, Masthead, PageFrame } from '@/app/layout'
import { PROGRAM, RECORDS, TODAY } from '@/content/copy'
import { isCatalogPracticeId, PRACTICE_BY_ID } from '@/content/practices'
import { hardMoment, programDay, quickPicks, recommend, type Shortcut, type TodayPick } from '@/content/today'
import type { ProgramId } from '@/content/types'
import { usePrefs, useRecords, useStats, useToday } from '@/data'
import { dayKey, startOfWeek } from '@/lib/date'
import {
  Button,
  ButtonLink,
  clauses,
  GradeMark,
  Kicker,
  LinkMore,
  PracticeList,
  PracticeRow,
  ScaleGroup,
  Section,
  Sheet,
  useToast,
  WeekDots,
} from '@/ui'
import { HelpNumbers } from '@/widgets/HelpNumbers'
import { StartButton } from '@/widgets/StartButton'
import { RecommendationFigure } from './RecommendationFigure'
import styles from './Today.module.css'
import { useRecommendationTime } from './useRecommendationTime'

function start(item: Shortcut, from: StartSource): void {
  if (!isCatalogPracticeId(item.practiceId)) return
  startPractice({
    practiceId: item.practiceId,
    minutes: item.minutes,
    from,
    ...(item.params ? { overrides: { params: item.params } } : {}),
  })
}

export function TodayPage() {
  const screening = usePrefs(s => s.safety.screening)
  const programs = usePrefs(s => s.programs)
  const { records, loading } = useRecords()
  const today = useToday()
  const now = useRecommendationTime()
  const stats = useStats(now)
  const recommendation = useMemo(() => {
    const active = (Object.entries(programs) as [ProgramId, NonNullable<(typeof programs)[ProgramId]>][])
      .filter(([programId, progress]) => progress && programDay({ programId, ...progress }, now))
      .sort((a, b) => b[1].startedOn.localeCompare(a[1].startedOn))[0]
    return recommend({
      now,
      program: active ? { programId: active[0], ...active[1] } : null,
      lastPracticeAt: records.find(r => r.actualSec > 0 && r.date <= today)?.date ?? null,
      screening,
    })
  }, [now, programs, records, screening, today])
  const [selection, setSelection] = useState({ key: recommendation, index: 0 })
  const pairDay =
    recommendation.programDay?.programId === 'mindfulness-8w' && recommendation.programDay.week === 7
      ? recommendation.programDay.key
      : null
  const firstDone =
    pairDay !== null &&
    records.some(
      r =>
        r.params.program === 'mindfulness-8w' &&
        r.params.programDay === pairDay &&
        r.date >= (programs['mindfulness-8w']?.startedOn ?? today) &&
        r.practiceId === 'focus' &&
        r.completed &&
        r.actualSec >= 300,
    )
  const choices: TodayPick[] = [recommendation, ...recommendation.alternatives].flatMap(pick => {
    if (!pairDay || pick.plan?.day !== pairDay) return [pick]
    if (pick.plan.role === 'day' && pick.practiceId === 'self-compassion') {
      const short = {
        ...pick,
        plan: { ...pick.plan, role: 'short' as const },
        reason: TODAY.program.short(recommendation.programDay!.title),
      }
      const main = firstDone
        ? pick
        : { ...pick, practiceId: 'focus' as const, plan: { ...pick.plan, countsAsDay: false } }
      return [main, short]
    }
    // 两段主练习的首段不能从另一个入口提前计为完成这一天。
    return pick.practiceId === 'focus' ? [] : [pick]
  })
  const index = selection.key === recommendation ? selection.index : 0
  const pick = choices[index] ?? recommendation
  const practice = isCatalogPracticeId(pick.practiceId) ? PRACTICE_BY_ID[pick.practiceId] : null
  const [hardOpen, setHardOpen] = useState(false)
  const [stressOpen, setStressOpen] = useState(false)
  const stressEnabled = usePrefs(s => s.weeklyStress)
  const stressRatings = usePrefs(s => s.stressRatings)
  const saveStress = usePrefs(s => s.addStressRating)
  const toast = useToast()
  const monday = dayKey(startOfWeek(now))
  const stressDue =
    stressEnabled &&
    !recommendation.programDay &&
    !stressRatings.some(r => r.date >= monday && r.date <= today)

  const picks = quickPicks(screening)
  const hard = hardMoment(screening)
  const day = recommendation.programDay
  const days = stats.weekDots.map(d => ({
    date: d.key,
    minutes: d.seconds / 60,
    state: d.today ? ('today' as const) : d.future ? ('future' as const) : ('past' as const),
  }))
  const hardContent = (
    <>
      <p className="ink-2">{hard.intro}</p>
      <PracticeList>
        {hard.items.map(item =>
          item.kind === 'practice' ? (
            <PracticeRow
              key={item.practiceId}
              practice={isCatalogPracticeId(item.practiceId) ? PRACTICE_BY_ID[item.practiceId] : undefined}
              name={item.label}
              description={item.hint}
              endText={item.duration}
              onClick={() => {
                setHardOpen(false)
                start(item, 'hard-moment')
              }}
            />
          ) : null,
        )}
      </PracticeList>
      <HelpNumbers variant="grid" />
    </>
  )
  return (
    <PageFrame title={TODAY.title}>
      <h1 className="vh" tabIndex={-1}>
        {TODAY.title}
      </h1>
      <Masthead />
      <div className={styles.grid}>
        <div className={styles.main}>
          <Dateline date={now} />
          {practice && (
            <section
              className={styles.recommendation}
              aria-labelledby="recommendation-title"
              aria-busy={loading}
            >
              <Kicker
                start={day?.doneToday && index === 0 ? TODAY.program.doneToday : pick.reason}
                end={<GradeMark grade={practice.grade} prefix />}
                tone={recommendation.source === 'welcome-back' ? 'note' : 'meta'}
              />
              <div className={styles.title}>
                <h2 id="recommendation-title" className="t-display">
                  {practice.name}
                </h2>
                <Button
                  variant="quiet"
                  icon="refresh"
                  onClick={() => setSelection({ key: recommendation, index: (index + 1) % choices.length })}
                >
                  {TODAY.change}
                </Button>
              </div>
              {day?.doneToday && index === 0 && (
                <p className="t-caption ink-3">{TODAY.program.next(day.week, day.day)}</p>
              )}
              <p className={styles.description}>
                {pick.plan && day?.firstDayOfWeek
                  ? TODAY.program.newWeek(day.week)
                  : clauses(practice.todayLine)}
              </p>
              {pick.plan && day?.firstDayOfWeek && (
                <LinkMore to={`/program/${pick.plan.programId}`}>{PROGRAM.reading}</LinkMore>
              )}
              {pairDay && pick.plan?.role === 'day' && (
                <p className="t-caption ink-2">{firstDone ? PROGRAM.second : PROGRAM.paired}</p>
              )}
              <figure className={styles.figure}>
                <RecommendationFigure practice={practice} minutes={pick.minutes} />
              </figure>
              {practice.id === 'pace-finder' ? (
                <ButtonLink className={styles.start} variant="primary" to="/pace-finder">
                  {practice.name}
                </ButtonLink>
              ) : (
                <StartButton
                  className={styles.start}
                  practiceId={practice.id}
                  minutes={pick.minutes}
                  from="today"
                  {...(pick.params ? { overrides: { params: pick.params } } : {})}
                  {...(pick.plan ? { programDay: pick.plan } : {})}
                />
              )}
            </section>
          )}
        </div>
        <div className={styles.aside}>
          <Section title={TODAY.quick.title} className={styles.quick}>
            <PracticeList>
              {picks.map(p => (
                <PracticeRow
                  key={p.practiceId}
                  practice={isCatalogPracticeId(p.practiceId) ? PRACTICE_BY_ID[p.practiceId] : undefined}
                  name={p.label}
                  description={p.structure}
                  hint={p.hint}
                  minutes={p.minutes}
                  onClick={() => start(p, 'today')}
                />
              ))}
              <PracticeRow
                variant="nav"
                glyph="grounding"
                name={hard.title}
                description={hard.rowHint}
                end="chevron"
                opensDialog
                onClick={() => setHardOpen(true)}
                className={styles.hardRow}
              />
            </PracticeList>
          </Section>
          <section className={styles.week} aria-labelledby="week-title">
            <div>
              <h2 id="week-title">{TODAY.week.title}</h2>
              <p>{TODAY.week.value(stats.week.days, Math.round(stats.week.seconds / 60))}</p>
            </div>
            <div className={styles.weekActions}>
              {stressDue && (
                <Button variant="quiet" size="sm" onClick={() => setStressOpen(true)}>
                  {TODAY.weeklyStress}
                </Button>
              )}
              <WeekDots days={days} />
            </div>
          </section>
          <Section title={hard.title} className={styles.hardDesktop}>
            {hardContent}
          </Section>
        </div>
      </div>
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
          anchors={{ low: RECORDS.weeklyStress.low, high: RECORDS.weeklyStress.high }}
          value={null}
          onChange={score => {
            saveStress(score)
            setStressOpen(false)
            toast.show({ message: RECORDS.weeklyStress.saved })
          }}
        />
      </Sheet>
      <Sheet open={hardOpen} onClose={() => setHardOpen(false)} title={hard.title} closeButton>
        {hardContent}
      </Sheet>
    </PageFrame>
  )
}
