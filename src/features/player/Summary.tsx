import { useState } from 'react'
import {
  closeSummary,
  practiceAgain,
  type SessionSummary,
  startPractice,
  submitCheckin,
  submitFeeling,
  submitNote,
  usePendingSession,
} from '@/app/flows'
import { PageFrame } from '@/app/layout'
import { PLAYER, SUMMARY, TODAY } from '@/content/copy'
import { type CatalogPracticeId, isCatalogPracticeId, PRACTICE_BY_ID } from '@/content/practices'
import { AFTER_PRACTICE, CRISIS_CARD, STOP_GUIDANCE } from '@/content/safety'
import { useStats } from '@/data'
import { fmtMinutes, pad2 } from '@/lib/time'
import {
  Button,
  Dock,
  FocusTimeline,
  IconButton,
  Kicker,
  Lead,
  LinkMore,
  PracticeList,
  PracticeRow,
  Readouts,
  Sheet,
  StepChart,
  stepSections,
  TextField,
  typeset,
  Unit,
  useToast,
} from '@/ui'
import { CheckinScale } from '@/widgets/CheckinScale'
import { FeelingChoice } from '@/widgets/FeelingChoice'
import { HelpNumbers } from '@/widgets/HelpNumbers'
import styles from './Player.module.css'

function timeRange(startedAt: string, sec: number): string {
  const start = new Date(startedAt)
  const end = new Date(start.getTime() + sec * 1000)
  const hm = (date: Date): string => `${pad2(date.getHours())}:${pad2(date.getMinutes())}`
  return SUMMARY.timeRange
    .replace('{month}', String(start.getMonth() + 1))
    .replace('{day}', String(start.getDate()))
    .replace('{start}', hm(start))
    .replace('{end}', hm(end))
}
export function SummaryPage() {
  const summary = usePendingSession(s => s.summary)
  return summary ? <Summary key={summary.result.startedAt} summary={summary} /> : null
}
function Summary({ summary }: { summary: SessionSummary }) {
  const { result, record, questions, answers } = summary
  const [note, setNote] = useState(answers.note ?? record?.note ?? '')
  const [unwell, setUnwell] = useState(false)
  const [saving, setSaving] = useState(false)
  const toast = useToast()
  const stats = useStats()
  const practiceId = result.plan.practiceId as CatalogPracticeId
  const practice = PRACTICE_BY_ID[practiceId]
  const failed = (): void => toast.show({ message: SUMMARY.saveFailed })
  const done = async (): Promise<void> => {
    setSaving(true)
    try {
      if (record) await submitNote(note)
      closeSummary()
    } catch {
      failed()
      setSaving(false)
    }
  }
  const saveNote = (): void => {
    if (record) void submitNote(note).catch(failed)
  }
  return (
    <PageFrame title={SUMMARY.title} variant="dock" className={styles.summary}>
      <div className={styles.summaryBody}>
        <div className={styles.close}>
          <IconButton icon="close" label={SUMMARY.close} onClick={() => void done()} />
        </div>
        <Kicker start={timeRange(result.startedAt, result.practicedSec)} end={SUMMARY.title} />
        <h1 tabIndex={-1}>{practice.name}</h1>
        <Lead>{record ? SUMMARY.practiced(fmtMinutes(result.practicedSec)) : SUMMARY.notRecorded}</Lead>
        {record && !result.completed && <p className="t-caption ink-3">{SUMMARY.endedEarly}</p>}
        {record && practice.kind !== 'sound' && (
          <div className={styles.data}>
            {practice.kind === 'focus' ? (
              <>
                <p className={styles.dataHead}>
                  <span className="t-caption ink-3">{PLAYER.focus.mark}</span>
                  <span className={styles.readout}>
                    {result.marks.length}
                    <Unit>{PLAYER.units.times}</Unit>
                  </span>
                </p>
                <FocusTimeline minutes={result.practicedSec / 60} marks={result.marks} />
                <p className="t-caption ink-3">
                  {SUMMARY.marksCaption} {SUMMARY.marksNote}
                </p>
              </>
            ) : result.count ? (
              <>
                <p>{SUMMARY.count(result.count.correct, result.count.errors, result.count.resets)}</p>
                {result.count.invalid > 0 && (
                  <p className="t-caption ink-3">{SUMMARY.invalid(result.count.invalid)}</p>
                )}
              </>
            ) : result.breaths !== null ? (
              <>
                <Readouts
                  variant="spec"
                  items={[
                    {
                      label: PLAYER.readouts.rounds,
                      value: String(result.breaths),
                      unit: PLAYER.units.rounds,
                    },
                    {
                      label: PLAYER.readouts.rate,
                      value: (result.finalRate ?? result.plan.pattern?.rate ?? 0).toFixed(1),
                      unit: PLAYER.units.rate,
                    },
                  ]}
                />
                {result.rateSteps > 0 && (
                  <p className="t-caption ink-3">{SUMMARY.hurried(result.finalRate ?? 0)}</p>
                )}
              </>
            ) : result.plan.timeline ? (
              <StepChart
                sections={stepSections(result.plan.timeline, TODAY.start)}
                duration={result.plan.plannedSec}
                name={practice.name}
                step={practiceId === 'body-scan' ? 6 : 0}
                skipped={result.skipped}
              />
            ) : (
              <p>
                {SUMMARY.timer(
                  result.practicedSec / 60,
                  result.plan.intervalSec
                    ? Math.max(0, Math.ceil(result.practicedSec / result.plan.intervalSec) - 1)
                    : 0,
                )}
              </p>
            )}
          </div>
        )}
        {record && (
          <p className={styles.week}>
            <span>{SUMMARY.weekLabel}</span>
            <span>{TODAY.week.value(stats.week.days, Math.round(stats.week.seconds / 60))}</span>
          </p>
        )}
        {questions.feeling && (
          <FeelingChoice
            value={answers.feeling ?? null}
            onChange={feeling => {
              void submitFeeling(feeling).catch(failed)
              if (feeling === 'unwell') setUnwell(true)
            }}
          />
        )}
        {summary.gentler && (
          <section className={styles.gentler} aria-labelledby="gentler-title">
            <h2 id="gentler-title">{AFTER_PRACTICE.gentler.title}</h2>
            {AFTER_PRACTICE.gentler.paragraphs.map(line => (
              <p key={line}>{typeset(line)}</p>
            ))}
            <PracticeList>
              {AFTER_PRACTICE.gentler.suggestions.map(
                item =>
                  isCatalogPracticeId(item.practiceId) && (
                    <PracticeRow
                      key={item.practiceId}
                      practice={PRACTICE_BY_ID[item.practiceId]}
                      minutes={item.minutes}
                      onClick={() => {
                        saveNote()
                        startPractice({
                          practiceId: item.practiceId as CatalogPracticeId,
                          minutes: item.minutes,
                          from: 'summary',
                        })
                      }}
                    />
                  ),
              )}
            </PracticeList>
            <LinkMore to="/help">{AFTER_PRACTICE.gentler.help}</LinkMore>
          </section>
        )}
        {questions.checkin && (
          <CheckinScale
            value={answers.post ?? null}
            onChange={post => void submitCheckin(post).catch(failed)}
          />
        )}
        {record && (
          <div className={styles.note}>
            <TextField
              label={SUMMARY.note.label}
              placeholder={SUMMARY.note.placeholder}
              value={note}
              onChange={setNote}
              onBlur={saveNote}
              maxLength={200}
              counterFrom={180}
              multiline
            />
          </div>
        )}
        {!summary.gentler && (
          <LinkMore to="/help" size="caption">
            {CRISIS_CARD.title}
          </LinkMore>
        )}
        {record && (
          <Button
            variant="quiet"
            onClick={() => {
              saveNote()
              practiceAgain()
            }}
          >
            {SUMMARY.again}
          </Button>
        )}
        <Dock className={styles.summaryDock}>
          <Button
            variant="primary"
            block
            aria-disabled={saving}
            onClick={() => {
              if (!saving) void done()
            }}
          >
            {SUMMARY.done}
          </Button>
        </Dock>
      </div>
      <Sheet
        open={unwell}
        onClose={() => setUnwell(false)}
        title={AFTER_PRACTICE.unwell.title}
        footer={
          <Button variant="secondary" block onClick={() => setUnwell(false)}>
            {SET_CLOSE}
          </Button>
        }
      >
        {AFTER_PRACTICE.unwell.paragraphs.map(line => (
          <p key={line}>{typeset(line)}</p>
        ))}
        <Button
          variant="primary"
          block
          onClick={() => {
            saveNote()
            startPractice({ practiceId: 'grounding', minutes: 1, from: 'distress' })
          }}
        >
          {STOP_GUIDANCE.actions.grounding}
        </Button>
        <HelpNumbers variant="grid" />
      </Sheet>
    </PageFrame>
  )
}
const SET_CLOSE = PLAYER.close
