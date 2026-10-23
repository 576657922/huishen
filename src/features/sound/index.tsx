import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { rememberSound } from '@/app/flows'
import { NavBar, PageFrame } from '@/app/layout'
import { defaultMinutes } from '@/app/plan'
import type { SoundMode } from '@/audio/types'
import { CATALOGUE, DETAIL, EVIDENCE, SETTINGS } from '@/content/copy'
import { loadEvidence, type PracticeEvidence } from '@/content/evidence'
import { CATEGORY_LABEL, PRACTICE_BY_ID, soundModeOf } from '@/content/practices'
import { CRISIS_CARD } from '@/content/safety'
import { LISTEN, listenLabel, SOUND_COPY, UNLIMITED, UNLIMITED_CONFIRM } from '@/content/sounds'
import { usePrefs } from '@/data'
import { isIOSDevice } from '@/lib/device'
import {
  Cite,
  ConfirmDialog,
  clauses,
  Dock,
  GradeMark,
  Kicker,
  Lead,
  LinkMore,
  Notes,
  Section,
  Segmented,
  StackRow,
  typeset,
} from '@/ui'
import { SoundPicker } from '@/widgets/SoundPicker'
import { StartButton } from '@/widgets/StartButton'
import styles from './Sound.module.css'

export function SoundDetailPage() {
  const id = useLocation().pathname.endsWith('/sleep') ? 'sleep' : 'listen'
  return <SoundSetup key={id} id={id} />
}
function SoundSetup({ id }: { id: 'listen' | 'sleep' }) {
  const practice = PRACTICE_BY_ID[id],
    mode = soundModeOf(id),
    prefs = usePrefs(),
    navigate = useNavigate()
  const minutes = defaultMinutes(id, prefs, prefs.safety.screening)
  const [confirm, setConfirm] = useState(false),
    [notes, setNotes] = useState<PracticeEvidence | null>(null)
  useEffect(() => {
    let live = true
    void loadEvidence().then(
      index => {
        if (live) setNotes(index.notesFor(id))
      },
      () => {},
    )
    return () => {
      live = false
    }
  }, [id])
  const select = (value: number): void => {
    if (value === UNLIMITED && minutes !== UNLIMITED) setConfirm(true)
    else prefs.setPractice(id, { minutes: value })
  }
  return (
    <PageFrame title={practice.name} variant="dock">
      <NavBar backTo="/practices" backLabel={CATALOGUE.title} />
      <div className={styles.grid}>
        <div className={styles.intro}>
          <Kicker
            start={CATEGORY_LABEL[practice.category]}
            end={<GradeMark grade={practice.grade} prefix />}
          />
          <h1 tabIndex={-1}>{practice.name}</h1>
          <Lead>
            {practice.description
              .match(/[^。]+。/g)
              ?.slice(0, 2)
              .join('') ?? practice.description}
          </Lead>
          <figure className={styles.figure}>
            <svg
              className={styles.plot}
              viewBox="0 0 600 100"
              role="img"
              aria-label={DETAIL.figureCaption[id]}
            >
              <path className={styles.axis} d="M0 76.5H600" />
              <path
                className={styles.trace}
                d={minutes === 0 ? 'M0 20H600' : 'M0 20H480C540 20 540 76 600 76'}
              />
            </svg>
            <figcaption>
              {DETAIL.figure} · {minutes === 0 ? listenLabel(0) : DETAIL.figureCaption[id]}
            </figcaption>
          </figure>
        </div>
        <aside className={styles.controls}>
          <Section title={SETTINGS.sound.title} aside={DETAIL.settingsAside} className={styles.settings}>
            <Segmented
              label={SETTINGS.sound.defaults.label}
              value={mode}
              onChange={(next: SoundMode) => navigate(`/practices/${LISTEN[next].practiceId}`)}
              options={Object.entries(LISTEN).map(([value, item]) => ({
                value: value as SoundMode,
                label: item.name,
              }))}
            />
            <SoundPicker
              value={prefs.sounds[mode]}
              mode={mode}
              onChange={next => rememberSound(id, next)}
              preview
              volumes
            />
            <StackRow label={DETAIL.durationLabel}>
              {({ labelId }) => (
                <Segmented
                  labelledBy={labelId}
                  value={minutes}
                  onChange={select}
                  options={LISTEN[mode].minutes.map(value => ({ value, label: listenLabel(value) }))}
                />
              )}
            </StackRow>
            <p className="t-caption ink-3">{typeset(LISTEN[mode].note)}</p>
            {isIOSDevice() && (
              <div className={styles.advice}>
                <h3 className="t-name">{SOUND_COPY.iosLock.title}</h3>
                {SOUND_COPY.iosLock.lines.map(line => (
                  <p key={line}>{typeset(line)}</p>
                ))}
              </div>
            )}
          </Section>
          <Dock>
            <StartButton practiceId={id} from="catalogue" minutes={minutes} />
          </Dock>
        </aside>
        <div className={styles.research}>
          <Section
            title={DETAIL.sections.evidence}
            aside={<LinkMore to={`/evidence#${practice.evidence[0]}`}>{DETAIL.allEvidence}</LinkMore>}
          >
            <ul className={styles.claims}>
              {practice.evidenceClaims.map(claim => (
                <li key={claim.claim}>
                  <p>
                    {typeset(claim.claim)}{' '}
                    {claim.cites.map((cite, n) => (
                      <Cite
                        key={cite}
                        n={notes?.notes.find(note => note.id === cite)?.number ?? n + 1}
                        href={`/evidence#${cite}`}
                      />
                    ))}
                  </p>
                  <GradeMark grade={claim.grade} />
                </li>
              ))}
            </ul>
            <p className="t-caption ink-3">{EVIDENCE.grades.scope}</p>
            {notes && (
              <Notes
                items={notes.notes.map(note => ({
                  who: note.byline,
                  type: note.type,
                  what: note.what,
                  venue: note.venue,
                  ...(note.doi ? { doi: note.doi } : {}),
                }))}
              />
            )}
          </Section>
          <Section title={SOUND_COPY.volume.title}>
            {SOUND_COPY.volume.lines.map(line => (
              <p key={line}>{clauses(line)}</p>
            ))}
          </Section>
          <Section title={DETAIL.sections.safety}>
            {practice.safety.map(line => (
              <p key={line}>{clauses(line)}</p>
            ))}
            <LinkMore to="/help">{CRISIS_CARD.title}</LinkMore>
          </Section>
        </div>
      </div>
      <ConfirmDialog
        open={confirm}
        title={UNLIMITED_CONFIRM.title}
        body={UNLIMITED_CONFIRM.paragraphs.map(line => <p key={line}>{typeset(line)}</p>)}
        confirmLabel={UNLIMITED_CONFIRM.confirm}
        cancelLabel={UNLIMITED_CONFIRM.cancel}
        onCancel={() => setConfirm(false)}
        onConfirm={() => {
          prefs.setPractice(id, { minutes: 0 })
          setConfirm(false)
        }}
      />
    </PageFrame>
  )
}
