import { useEffect, useState } from 'react'
import { useParams } from 'react-router'
import { rememberSound } from '@/app/flows'
import { NavBar, PageFrame } from '@/app/layout'
import { NotFound } from '@/app/pages/NotFound'
import { defaultMinutes } from '@/app/plan'
import type { SoundMix } from '@/audio/types'
import { CATALOGUE, DETAIL, EVIDENCE, PLAYER, SETTINGS } from '@/content/copy'
import { loadEvidence, type PracticeEvidence } from '@/content/evidence'
import {
  adjustedDefaults,
  CATEGORY_LABEL,
  type CatalogPractice,
  isCatalogPracticeId,
  isHidden,
  isOffered,
  PRACTICE_BY_ID,
} from '@/content/practices'
import { CRISIS_CARD } from '@/content/safety'
import { soundName } from '@/content/sounds'
import type { GuidanceLevel } from '@/content/types'
import { usePrefs } from '@/data'
import type { CueStyle } from '@/engine'
import {
  Cite,
  clauses,
  Dock,
  GradeMark,
  Kicker,
  Lead,
  LinkMore,
  NavRow,
  Notes,
  Row,
  Section,
  Segmented,
  Sheet,
  Slider,
  StackRow,
  Stepper,
  ToggleRow,
  typeset,
} from '@/ui'
import { SoundPicker } from '@/widgets/SoundPicker'
import { StartButton } from '@/widgets/StartButton'
import { PracticeFigure } from './PracticeFigure'
import styles from './Practices.module.css'

export function PracticeDetailPage() {
  const { id = '' } = useParams()
  if (!isCatalogPracticeId(id)) return <NotFound />
  return <Detail key={id} practice={PRACTICE_BY_ID[id]} />
}

function Detail({ practice }: { practice: CatalogPractice }) {
  const id = practice.id
  const prefs = usePrefs()
  const screening = prefs.safety.screening
  const adjusted = adjustedDefaults(id, screening)
  const own = prefs.practice[id] ?? {}
  const minutes = defaultMinutes(id, prefs, screening)
  const [soundOpen, setSoundOpen] = useState(false)
  const [notes, setNotes] = useState<PracticeEvidence | null>(null)
  const warmup = own.warmup ?? true
  const phase = own.phaseSec ?? 4
  useEffect(() => {
    let live = true
    void loadEvidence().then(
      index => {
        if (live) setNotes(index.notesFor(id))
      },
      () => {
        if (live) setNotes(null)
      },
    )
    return () => {
      live = false
    }
  }, [id])
  const rate =
    own.rate ?? prefs.personalRate ?? (adjusted.paced?.type === 'resonance' ? adjusted.paced.rate : 5.5)
  const ratio = own.ratio ?? (adjusted.paced?.type === 'resonance' ? adjusted.paced.ratio : 'long')
  const mix: SoundMix = {
    ambience: own.ambience ?? practice.sound.ambience,
    music: own.music ?? practice.sound.music,
    ambienceVolume: prefs.volume.ambience,
    musicVolume: prefs.volume.music,
    mode: 'relax',
  }
  const soundValue =
    [mix.ambience, mix.music]
      .filter(id => id !== 'none')
      .map(soundName)
      .filter(Boolean)
      .join(' + ') || soundName('none')
  const hidden = isHidden(id, screening)
  const offered = isOffered(id)
  const lead =
    practice.description
      .match(/[^。]+。/g)
      ?.slice(0, 2)
      .join('') ?? practice.description
  const settings = (
    <Section title={DETAIL.sections.settings} aside={DETAIL.settingsAside} className={styles.settings}>
      {id === 'slow' && (
        <>
          <StackRow
            label={DETAIL.slow.rate}
            value={PLAYER.paced.rate(rate)}
            hint={
              <>
                {DETAIL.slow.rateHint}{' '}
                <LinkMore to="/pace-finder">{PRACTICE_BY_ID['pace-finder'].name}</LinkMore>
              </>
            }
          >
            {({ labelId, hintId }) => (
              <Slider
                min={4.5}
                max={7}
                step={0.5}
                value={rate}
                onChange={v => prefs.setPractice(id, { rate: v })}
                scale={[4.5, 5, 5.5, 6, 6.5, 7]}
                labelledBy={labelId}
                describedBy={hintId}
                valueText={PLAYER.paced.rate}
              />
            )}
          </StackRow>
          <StackRow label={DETAIL.slow.ratio} hint={DETAIL.slow.ratioHint}>
            {({ labelId }) => (
              <Segmented
                label={DETAIL.slow.ratio}
                labelledBy={labelId}
                value={ratio}
                onChange={(v: 'long' | 'equal') => prefs.setPractice(id, { ratio: v })}
                options={[
                  {
                    value: 'long',
                    label: DETAIL.slow.ratioLong(
                      Math.round((((60 / rate) * 4.5) / 11) * 2) / 2,
                      Math.round((((60 / rate) * 6.5) / 11) * 2) / 2,
                    ),
                  },
                  { value: 'equal', label: DETAIL.slow.ratioEqual },
                ]}
              />
            )}
          </StackRow>
          <ToggleRow
            label={DETAIL.slow.warmup}
            hint={DETAIL.slow.warmupHint}
            checked={warmup}
            onChange={warmup => prefs.setPractice(id, { warmup })}
          />
        </>
      )}
      {id === 'box' && (
        <Row
          label={DETAIL.boxPhase}
          end={
            <Stepper
              label={DETAIL.boxPhase}
              min={3}
              max={6}
              value={phase}
              onChange={phaseSec => prefs.setPractice(id, { phaseSec })}
              format={SETTINGS.practice.leadIn.value}
            />
          }
        />
      )}
      <StackRow label={DETAIL.durationLabel}>
        {({ labelId }) =>
          id === 'timer' ? (
            <Stepper
              values={adjusted.durations}
              value={minutes}
              onChange={v => prefs.setPractice(id, { minutes: v })}
              labelledBy={labelId}
            />
          ) : (
            <Segmented
              labelledBy={labelId}
              options={adjusted.durations.map(value => ({
                value,
                label: String(value),
                ...(id === 'breath-count' && value === 15 ? { sub: DETAIL.measureLabel } : {}),
              }))}
              value={minutes}
              onChange={v => prefs.setPractice(id, { minutes: v })}
            />
          )
        }
      </StackRow>
      {(practice.kind === 'guided' || practice.kind === 'focus') && (
        <StackRow
          label={SETTINGS.guidance.level.label}
          hint={SETTINGS.guidance.level.options[adjusted.guidance ?? prefs.guidance].help}
        >
          {({ labelId }) => (
            <Segmented
              labelledBy={labelId}
              value={adjusted.guidance ?? prefs.guidance}
              onChange={(guidance: GuidanceLevel) => prefs.set({ guidance })}
              options={Object.entries(SETTINGS.guidance.level.options).map(([value, option]) => ({
                value: value as GuidanceLevel,
                label: option.name,
              }))}
            />
          )}
        </StackRow>
      )}
      {id === 'timer' && (
        <>
          <StackRow label={SETTINGS.sound.interval.label} hint={SETTINGS.sound.interval.help}>
            {({ labelId }) => (
              <Segmented
                labelledBy={labelId}
                value={prefs.intervalBell}
                onChange={v => prefs.set({ intervalBell: v })}
                options={([0, 5, 10] as const).map(value => ({
                  value,
                  label: value ? SETTINGS.sound.interval.every(value) : SETTINGS.sound.interval.off,
                }))}
              />
            )}
          </StackRow>
          <ToggleRow
            label={SETTINGS.sound.bells.label}
            hint={SETTINGS.sound.bells.help}
            checked={prefs.bells}
            onChange={bells => prefs.set({ bells })}
          />
        </>
      )}
      <NavRow
        label={SETTINGS.sound.title}
        value={soundValue}
        onClick={() => setSoundOpen(true)}
        opensDialog
      />
      {practice.kind === 'paced' && (
        <StackRow
          label={SETTINGS.sound.cueStyle.label}
          hint={SETTINGS.sound.cueStyle.options[prefs.cueStyle].help}
        >
          {({ labelId }) => (
            <Segmented
              labelledBy={labelId}
              value={prefs.cueStyle}
              onChange={(cueStyle: CueStyle) => prefs.set({ cueStyle })}
              options={Object.entries(SETTINGS.sound.cueStyle.options).map(([value, option]) => ({
                value: value as CueStyle,
                label: option.name,
              }))}
            />
          )}
        </StackRow>
      )}
    </Section>
  )
  const start =
    offered && !hidden ? (
      <StartButton practiceId={id} minutes={minutes} from="catalogue" />
    ) : (
      <p>{hidden ? CATALOGUE.hidden([practice.name]) : DETAIL.notOffered}</p>
    )
  return (
    <PageFrame title={practice.name} variant="dock">
      <NavBar backTo="/practices" backLabel={CATALOGUE.title} />
      <div className={styles.detailGrid}>
        <div className={styles.intro}>
          <Kicker
            start={CATEGORY_LABEL[practice.category]}
            end={<GradeMark grade={practice.grade} prefix />}
          />
          <h1 tabIndex={-1}>{practice.name}</h1>
          <Lead>{lead}</Lead>
          <figure className={styles.figure}>
            <PracticeFigure
              practice={practice}
              minutes={id === 'focus' ? minutes : practice.defaultMinutes}
            />
            <figcaption>
              {DETAIL.figure} · {DETAIL.figureCaption[id]}
            </figcaption>
          </figure>
          <Section
            title={DETAIL.sections.how}
            aside={DETAIL.durations(
              adjusted.durations[0] ?? minutes,
              adjusted.durations.at(-1) ?? minutes,
              adjusted.defaultMinutes,
            )}
          >
            <ol className={styles.steps}>
              {practice.steps.map((step, i) => (
                <li key={step}>
                  <span className="tnum ink-3">{String(i + 1).padStart(2, '0')}</span>
                  <p>{typeset(step)}</p>
                </li>
              ))}
            </ol>
            {practice.scriptId && practice.kind !== 'paced' && (
              <div className={styles.howto}>
                <p>{DETAIL.guidance.intro}</p>
                <p>{adjusted.eyesOpen ? DETAIL.guidance.eyesOpen : DETAIL.guidance.closable}</p>
              </div>
            )}
          </Section>
        </div>
        <aside className={styles.controls}>
          {settings}
          <Dock>{start}</Dock>
        </aside>
        <div className={styles.research}>
          <Section
            title={DETAIL.sections.evidence}
            aside={
              <LinkMore to={`/evidence${practice.evidence[0] ? `#${practice.evidence[0]}` : ''}`}>
                {DETAIL.allEvidence}
              </LinkMore>
            }
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
          <Section title={DETAIL.sections.safety}>
            {[...practice.safety, ...adjusted.notes].map(line => (
              <p key={line}>{clauses(line)}</p>
            ))}
            <LinkMore to="/help">{CRISIS_CARD.title}</LinkMore>
          </Section>
        </div>
      </div>
      <Sheet open={soundOpen} onClose={() => setSoundOpen(false)} title={SETTINGS.sound.title} closeButton>
        <SoundPicker mode="relax" value={mix} onChange={value => rememberSound(id, value)} preview volumes />
      </Sheet>
    </PageFrame>
  )
}
