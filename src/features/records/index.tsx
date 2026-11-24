import { useEffect, useMemo, useState } from 'react'
import { PageFrame } from '@/app/layout'
import { getRepo } from '@/app/services'
import { DETAIL, PLAYER, PROGRAM, RECORDS, SETTINGS, SUMMARY } from '@/content/copy'
import { isCatalogPracticeId, PRACTICE_BY_ID } from '@/content/practices'
import { PROGRAMS } from '@/content/programs'
import { AFTER_PRACTICE, CRISIS_CARD } from '@/content/safety'
import { getScript } from '@/content/scripts'
import { soundName } from '@/content/sounds'
import {
  countAccuracy,
  monthCalendar,
  parseProgramDay,
  practiceBreakdown,
  recordsBetween,
  type SessionRecord,
  totals,
  usePrefs,
  useRecords,
  useStats,
  useToday,
} from '@/data'
import { addDays, dayKey, fmtDate, fmtWhen, parseDayKey } from '@/lib/date'
import { getLanguage } from '@/lib/locale'
import { fmtMinutes, pad2 } from '@/lib/time'
import {
  Button,
  ConfirmDialog,
  CountRows,
  DisclosureRow,
  DotPlot,
  EmptyState,
  IconButton,
  LinkMore,
  ListGroup,
  MonthCalendar,
  PageHead,
  PracticeBars,
  Row,
  Section,
  SessionsTable,
  Sheet,
  Sparkline,
  Tag,
  typeset,
  Unit,
  useToast,
  WeekDots,
} from '@/ui'
import { CheckinStrips, PlotWidth, StressPlot } from './Charts'
import { exportRecords, weeklyRatings } from './export'
import styles from './Records.module.css'

const nameOf = (r: SessionRecord): string =>
  isCatalogPracticeId(r.practiceId) ? PRACTICE_BY_ID[r.practiceId].name : r.practiceId
const feelingOf = (r: SessionRecord): string =>
  AFTER_PRACTICE.options.find(o => o.value === r.feeling)?.label ?? '—'
const monthName = (month: number): string => RECORDS.month.replace('{month}', String(month))
const fullMonthName = (year: number, month: number): string =>
  RECORDS.yearMonth.replace('{year}', String(year)).replace('{month}', String(month))
const percent = (value: number): string => `${Math.round(value * 100)}%`
const monthDay = (iso: string): string => {
  const d = new Date(iso)
  return `${d.getMonth() + 1}月${d.getDate()}日`
}
const shortWeekday = (d: Date): string =>
  new Intl.DateTimeFormat(getLanguage(), { weekday: 'short' }).format(d)
const startClock = (iso: string): string => {
  const d = new Date(iso)
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}
function dataOf(r: SessionRecord): string {
  const data: string[] = []
  if (r.marks) data.push(SUMMARY.marks(r.marks.length))
  if (r.breaths !== undefined) data.push(PLAYER.paced.round(r.breaths))
  if (r.rate !== undefined) data.push(PLAYER.paced.rate(r.rate))
  if (r.count)
    data.push(
      `${RECORDS.count.accuracy} ${countAccuracy(r.count) === null ? '—' : percent(countAccuracy(r.count) ?? 0)}`,
      `${RECORDS.count.resets} ${r.count.resets}`,
    )
  if (r.feeling) data.push(feelingOf(r))
  return data.join(' · ')
}
function parameterValue(key: string, value: string | number): string {
  if (key === 'rate' && typeof value === 'number') return PLAYER.paced.rate(value)
  if (key === 'ratio') return value === 'equal' ? DETAIL.slow.ratioEqual : DETAIL.slow.ratioLongLabel
  if (key === 'level' && Object.hasOwn(SETTINGS.guidance.level.options, value))
    return SETTINGS.guidance.level.options[value as keyof typeof SETTINGS.guidance.level.options].name
  if (key === 'mode') return value === 'sleep' ? SETTINGS.sound.mode.sleep : SETTINGS.sound.mode.relax
  if (key === 'interval' && typeof value === 'number')
    return value ? SETTINGS.sound.interval.every(value) : SETTINGS.sound.interval.off
  if (key === 'program' && Object.hasOwn(PROGRAMS, value))
    return PROGRAMS[value as keyof typeof PROGRAMS].title
  if (key === 'programDay') {
    const day = parseProgramDay(value)
    if (day) return PROGRAM.day.replace('{week}', String(day.week)).replace('{day}', String(day.day))
  }
  return String(value)
}
function skippedNames(record: SessionRecord): string {
  const practice = isCatalogPracticeId(record.practiceId) ? PRACTICE_BY_ID[record.practiceId] : null
  const sections = practice?.scriptId ? getScript(practice.scriptId).sections : []
  return (record.skipped ?? [])
    .map(id => sections.find(section => section.id === id)?.title ?? RECORDS.skipped)
    .join(' · ')
}
export function RecordsPage() {
  const { records, loading, error } = useRecords()
  const today = useToday()
  const now = useMemo(() => parseDayKey(today), [today])
  const stats = useStats(now)
  const prefs = usePrefs()
  const toast = useToast()
  const [wide, setWide] = useState(() => window.matchMedia?.('(min-width: 1024px)').matches ?? false)
  useEffect(() => {
    const query = window.matchMedia?.('(min-width: 1024px)')
    if (!query) return
    const update = (): void => setWide(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  const [offset, setOffset] = useState(0)
  const [visible, setVisible] = useState(6)
  const [selected, setSelected] = useState<SessionRecord | null>(null)
  const [deleting, setDeleting] = useState(false)
  const month = new Date(now.getFullYear(), now.getMonth() + offset, 1)
  const currentMonth = recordsBetween(records, new Date(now.getFullYear(), now.getMonth(), 1), today)
  const breakdown = practiceBreakdown(currentMonth)
  const monthly = totals(currentMonth)
  const calendar = monthCalendar(records, month.getFullYear(), month.getMonth(), now)
  const stress = weeklyRatings(prefs.stressRatings)
  const weekDays = stats.weekDots.map(d => ({
    date: d.key,
    minutes: d.seconds / 60,
    state: d.today ? ('today' as const) : d.future ? ('future' as const) : ('past' as const),
  }))
  const from = dayKey(addDays(now, -27))
  const focus = stats.focus.filter(p => p.date >= from && p.date <= today)
  const remove = async (): Promise<void> => {
    if (!selected) return
    const record = selected
    try {
      await getRepo().remove(record.id)
      setDeleting(false)
      setSelected(null)
      toast.show({
        message: RECORDS.deleted,
        action: {
          label: RECORDS.undo,
          onAction: () => {
            void getRepo()
              .add(record)
              .catch(() => toast.show({ message: RECORDS.failed }))
          },
        },
      })
    } catch {
      toast.show({ message: RECORDS.failed })
    }
  }
  const desktopExportButtons = (
    <>
      <Button size="sm" icon="download" onClick={() => exportRecords('csv', records, prefs.stressRatings)}>
        {SETTINGS.data.export.csv}
      </Button>
      <Button size="sm" icon="download" onClick={() => exportRecords('json', records, prefs.stressRatings)}>
        {SETTINGS.data.export.json}
      </Button>
    </>
  )
  const mobileExportButtons = (
    <>
      <Button icon="download" block onClick={() => exportRecords('csv', records, prefs.stressRatings)}>
        {SETTINGS.data.export.csv}
      </Button>
      <Button icon="download" block onClick={() => exportRecords('json', records, prefs.stressRatings)}>
        {SETTINGS.data.export.json}
      </Button>
    </>
  )
  const countRows = stats.countSummary.trend
    .slice(-5)
    .reverse()
    .map(p => ({
      date: monthDay(p.startedAt),
      accuracy: p.accuracy,
      resets: p.resets,
    }))
  const barRows = breakdown.map(row => ({
    name: isCatalogPracticeId(row.practiceId) ? PRACTICE_BY_ID[row.practiceId].name : row.practiceId,
    minutes: Math.max(1, Math.round(row.seconds / 60)),
    sessions: row.sessions,
  }))
  const tableRows = records.slice(0, visible).map(r => {
    const d = parseDayKey(r.date)
    return {
      id: r.id,
      date: `${d.getMonth() + 1}月${d.getDate()}日`,
      weekday: shortWeekday(d),
      start: startClock(r.startedAt),
      practice: nameOf(r),
      minutes: Math.max(1, Math.round(r.actualSec / 60)),
      data: dataOf({ ...r, feeling: undefined }) || undefined,
      feeling: r.feeling ? feelingOf(r) : undefined,
      before: r.checkin?.pre ?? null,
      after: r.checkin?.post ?? null,
      note: r.note,
    }
  })
  const empty = !loading && records.length === 0
  return (
    <PageFrame title={RECORDS.title} className={styles.page}>
      <PageHead
        title={RECORDS.title}
        variant={wide ? 'subline' : 'folio'}
        subline={RECORDS.sessions(records.length)}
        actions={wide && records.length > 0 ? desktopExportButtons : undefined}
        folioStart={RECORDS.sessions(records.length)}
        folioEnd={<span className={styles.local}>{RECORDS.local}</span>}
      />
      {error && <p role="alert">{RECORDS.failed}</p>}
      {empty && (
        <EmptyState
          title={RECORDS.empty.title}
          body={RECORDS.empty.body}
          action={<LinkMore to="/practices">{RECORDS.goPractice}</LinkMore>}
        />
      )}
      {records.length > 0 && (
        <>
          <div className={styles.overview}>
            <section aria-labelledby="week">
              <h2 id="week">{RECORDS.week.title}</h2>
              <p className={styles.figure}>
                {stats.week.days}
                <Unit>{RECORDS.dayUnit}</Unit>
              </p>
              <p className="t-caption ink-3">{RECORDS.totalMinutes(Math.round(stats.week.seconds / 60))}</p>
              <WeekDots days={weekDays} size={wide ? 'desk' : 'phone'} />
            </section>
            <section aria-labelledby="month">
              <h2 id="month">{monthName(now.getMonth() + 1)}</h2>
              <p className={styles.figure}>
                {monthly.days}
                <Unit>{RECORDS.dayUnit}</Unit>
              </p>
              <p className="t-caption ink-3">
                {RECORDS.sessions(monthly.sessions)} ·{' '}
                {RECORDS.totalMinutes(Math.round(monthly.seconds / 60))}
              </p>
            </section>
            <div className={styles.streak}>
              <DisclosureRow label={RECORDS.streakNote.title}>
                <p>{RECORDS.streakNote.body}</p>
                <p className="t-caption ink-3">{RECORDS.streakNote.source}</p>
              </DisclosureRow>
            </div>
          </div>
          <div className={styles.grid}>
            <Section
              className={styles.calendar}
              title={
                offset === 0
                  ? monthName(month.getMonth() + 1)
                  : fullMonthName(month.getFullYear(), month.getMonth() + 1)
              }
              aside={
                <div className={styles.monthNav}>
                  <IconButton icon="back" label={RECORDS.prevMonth} onClick={() => setOffset(n => n - 1)} />
                  <IconButton
                    icon="chevron-right"
                    label={RECORDS.nextMonth}
                    disabled={offset >= 0}
                    onClick={() => setOffset(n => n + 1)}
                  />
                </div>
              }
            >
              <MonthCalendar
                year={month.getFullYear()}
                month={month.getMonth() + 1}
                today={today}
                practised={
                  new Set(
                    calendar
                      .flat()
                      .filter(d => d.practiced)
                      .map(d => d.key),
                  )
                }
              />
              <p className={styles.note}>{typeset(RECORDS.calendar)}</p>
            </Section>
            <Section className={styles.breakdown} title={RECORDS.byPractice.title}>
              <PracticeBars rows={barRows} />
            </Section>
            <Section className={styles.focus} title={RECORDS.focus.title} aside={RECORDS.focus.unit}>
              {focus.length ? (
                <PlotWidth>
                  {width => (
                    <DotPlot
                      width={width}
                      points={focus.map(p => ({ date: p.date, value: p.perTenMin, today: p.date === today }))}
                      from={from}
                      to={today}
                      label={RECORDS.focus.plotLabel
                        .replace('{n}', String(focus.length))
                        .replace('{min}', Math.min(...focus.map(p => p.perTenMin)).toFixed(1))
                        .replace('{max}', Math.max(...focus.map(p => p.perTenMin)).toFixed(1))}
                    />
                  )}
                </PlotWidth>
              ) : (
                <p className="ink-3">{RECORDS.noData}</p>
              )}
              <p className={styles.note}>{typeset(RECORDS.focus.note)}</p>
            </Section>
            <Section className={styles.count} title={RECORDS.count.title}>
              {!stats.countSummary.ready ? (
                <p className="ink-3">{typeset(RECORDS.count.notEnough)}</p>
              ) : wide ? (
                <CountRows rows={countRows} dots />
              ) : (
                <>
                  <div className={styles.trend}>
                    <Sparkline
                      values={stats.countSummary.trend.map(p => p.accuracy)}
                      lastIsToday={stats.countSummary.latest?.date === today}
                      label={RECORDS.count.accuracy}
                    />
                    <div className={styles.trendValue}>
                      <p className={styles.readout}>{percent(stats.countSummary.latest?.accuracy ?? 0)}</p>
                      <p className="t-caption ink-3">{RECORDS.count.latest}</p>
                    </div>
                  </div>
                  <CountRows rows={countRows} dots={false} />
                </>
              )}
              <div className={styles.countDisclosure}>
                <DisclosureRow label={RECORDS.count.howCounted}>
                  {RECORDS.count.explain.map(line => (
                    <p key={line}>{line}</p>
                  ))}
                </DisclosureRow>
              </div>
            </Section>
            <Section
              className={styles.checkin}
              title={RECORDS.checkin.title}
              aside={<Tag>{RECORDS.checkin.tag}</Tag>}
            >
              {stats.checkin.ready ? (
                <>
                  <div className={styles.medians}>
                    {(
                      [
                        ['before', stats.checkin.medianPre],
                        ['after', stats.checkin.medianPost],
                      ] as const
                    ).map(([key, value]) => (
                      <div key={key}>
                        <p className="t-caption ink-3">
                          {RECORDS.checkin[key]} · {RECORDS.checkin.median}
                        </p>
                        <p className={styles.figure}>{value}</p>
                      </div>
                    ))}
                  </div>
                  <CheckinStrips
                    points={stats.checkinPoints}
                    pre={stats.checkin.medianPre ?? 0}
                    post={stats.checkin.medianPost ?? 0}
                  />
                  <p className={styles.note}>{typeset(RECORDS.checkin.noise)}</p>
                </>
              ) : (
                <p className="ink-3">{typeset(RECORDS.checkin.notEnough)}</p>
              )}
              <p className={styles.note}>{typeset(RECORDS.checkin.caveat)}</p>
            </Section>
            {stress.length > 0 && (
              <Section
                className={styles.stress}
                title={RECORDS.weeklyStress.title}
                aside={<Tag>{RECORDS.weeklyStress.tag}</Tag>}
              >
                {stress.length >= 3 ? (
                  <PlotWidth>
                    {width => <StressPlot ratings={stress} width={width} today={today} />}
                  </PlotWidth>
                ) : (
                  <p>{RECORDS.weeklyStress.notEnough}</p>
                )}
                <p className={styles.note}>{typeset(RECORDS.weeklyStress.caveat)}</p>
              </Section>
            )}
          </div>
          <Section title={RECORDS.list.title}>
            <div className={styles.mobileList}>
              {records.slice(0, visible).map(r => (
                <button
                  key={r.id}
                  type="button"
                  className={styles.session}
                  onClick={() => setSelected(r)}
                  aria-haspopup="dialog"
                >
                  <span>
                    <span className="t-caption ink-3">{fmtWhen(r.startedAt, now)}</span>
                    <strong>{nameOf(r)}</strong>
                  </span>
                  <span>
                    <span>{fmtMinutes(r.actualSec)}</span>
                    <span className="t-caption ink-2">{dataOf(r)}</span>
                  </span>
                </button>
              ))}
              {visible < records.length && (
                <Button variant="quiet" onClick={() => setVisible(records.length)}>
                  {RECORDS.list.showEarlier(records.length - visible)}
                </Button>
              )}
            </div>
            <div className={styles.desktopTable}>
              <SessionsTable
                rows={tableRows}
                onOpen={id => {
                  const found = records.find(r => r.id === id)
                  if (found) setSelected(found)
                }}
                onDelete={id => {
                  const found = records.find(r => r.id === id)
                  if (found) {
                    setSelected(found)
                    setDeleting(true)
                  }
                }}
                more={
                  visible < records.length
                    ? {
                        label: RECORDS.list.showEarlier(records.length - visible),
                        onMore: () => setVisible(records.length),
                      }
                    : undefined
                }
              />
            </div>
          </Section>
          <Section className={styles.export} title={RECORDS.export}>
            <div className={styles.exportStack}>{mobileExportButtons}</div>
            <p className={styles.note}>{typeset(SETTINGS.data.export.help)}</p>
            <p className={styles.note}>{typeset(RECORDS.exportHelp)}</p>
          </Section>
        </>
      )}
      <LinkMore to="/help" className={styles.help}>
        {CRISIS_CARD.title}
      </LinkMore>
      <Sheet
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected ? nameOf(selected) : RECORDS.detail}
        closeButton
      >
        {selected && (
          <>
            <p className="ink-3">
              {fmtDate(parseDayKey(selected.date))} · {fmtWhen(selected.startedAt, now)}
            </p>
            <ListGroup>
              <Row label={RECORDS.duration} end={fmtMinutes(selected.actualSec)} />
              <Row label={RECORDS.planned} end={fmtMinutes(selected.plannedSec)} />
              <Row label={RECORDS.detail} end={selected.completed ? RECORDS.complete : RECORDS.early} />
              <Row label={SUMMARY.title} end={dataOf(selected) || '—'} />
              <Row
                label={PLAYER.sound}
                end={
                  [selected.sound.ambience, selected.sound.music]
                    .filter(id => id !== 'none')
                    .map(soundName)
                    .filter(Boolean)
                    .join(' + ') || soundName('none')
                }
              />
              {selected.count && (
                <Row
                  label={RECORDS.count.title}
                  end={SUMMARY.count(selected.count.correct, selected.count.errors, selected.count.resets)}
                />
              )}
              {selected.count?.invalid ? (
                <Row label={RECORDS.count.title} hint={SUMMARY.invalid(selected.count.invalid)} />
              ) : null}
              {selected.marks && (
                <Row
                  label={RECORDS.focus.title}
                  end={
                    selected.marks.map(t => SETTINGS.practice.leadIn.value(Math.round(t))).join(' · ') || '—'
                  }
                />
              )}
              {selected.checkin && (
                <>
                  <Row label={RECORDS.checkin.before} end={selected.checkin.pre ?? '—'} />
                  <Row label={RECORDS.checkin.after} end={selected.checkin.post ?? '—'} />
                </>
              )}
              {selected.skipped?.length ? <Row label={RECORDS.skipped} end={skippedNames(selected)} /> : null}
              {selected.hrv &&
                Object.entries(selected.hrv).map(([key, value]) => (
                  <Row
                    key={key}
                    label={RECORDS.hrvFields[key as keyof typeof RECORDS.hrvFields]}
                    end={value?.toFixed(1) ?? '—'}
                  />
                ))}
              {Object.entries(selected.params)
                .filter(([key]) => Object.hasOwn(RECORDS.paramLabels, key))
                .map(([key, value]) => (
                  <Row
                    key={key}
                    label={RECORDS.paramLabels[key as keyof typeof RECORDS.paramLabels]}
                    end={parameterValue(key, value)}
                  />
                ))}
              {selected.note && <Row label={SUMMARY.note.label} hint={selected.note} />}
            </ListGroup>
            <Button variant="danger" className={styles.deleteBtn} onClick={() => setDeleting(true)}>
              {RECORDS.deleteRecord}
            </Button>
          </>
        )}
      </Sheet>
      <ConfirmDialog
        open={deleting}
        title={RECORDS.list.confirmDelete}
        confirmLabel={RECORDS.list.delete}
        cancelLabel={RECORDS.cancel}
        tone="danger"
        onConfirm={() => void remove()}
        onCancel={() => setDeleting(false)}
      />
    </PageFrame>
  )
}
