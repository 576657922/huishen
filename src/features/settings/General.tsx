import { useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { exportRecords } from '@/app/flows/backup'
import { NavBar, PageFrame } from '@/app/layout'
import { getRepo } from '@/app/services'
import { NAV } from '@/app/strings'
import type { Bus, SoundMode } from '@/audio/types'
import { ABOUT, SETTINGS } from '@/content/copy'
import { DISCLAIMERS } from '@/content/safety'
import { parseImport, type StressRating, type ThemePref, usePrefs, useRecords, useStorageMode } from '@/data'
import type { CueStyle } from '@/engine'
import { dayKey, parseDayKey } from '@/lib/date'
import {
  Button,
  ConfirmDialog,
  ListGroup,
  NavRow,
  Row,
  Section,
  Segmented,
  Slider,
  StackRow,
  Stepper,
  ToggleRow,
  useToast,
} from '@/ui'
import { SoundPicker } from '@/widgets/SoundPicker'
import { CuePreview } from './CuePreview'
import { SettingsFrame } from './Frame'
import styles from './Settings.module.css'

const groups = [
  ['appearance', SETTINGS.appearance.title],
  ['sound', SETTINGS.sound.title],
  ['guidance', SETTINGS.guidance.title],
  ['practice', SETTINGS.practice.title],
  ['reminders', SETTINGS.reminder.title],
  ['safety', SETTINGS.safety.title],
  ['data', SETTINGS.data.title],
  ['about', ABOUT.title],
] as const
const percent = (value: number): string => `${value}%`
export function SettingsOverview() {
  const prefs = usePrefs()
  const { records, loading } = useRecords()
  const storage = useStorageMode()
  const [deleteStep, setDeleteStep] = useState<0 | 1 | 2>(0)
  const [busy, setBusy] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const toast = useToast()
  const navigate = useNavigate()
  const importFile = async (file: File): Promise<void> => {
    setBusy(true)
    try {
      const text = await file.text()
      const parsed = parseImport(text)
      if (parsed.records.length === 0 && parsed.errors.length > 0) {
        toast.show({ message: SETTINGS.data.import.invalid })
        return
      }
      const result = await getRepo().importMany(parsed.records)
      let weekly = false
      const source: unknown = JSON.parse(text.replace(/^\uFEFF/, ''))
      if (
        typeof source === 'object' &&
        source !== null &&
        'weeklyStress' in source &&
        Array.isArray(source.weeklyStress)
      ) {
        const incoming: StressRating[] = source.weeklyStress.flatMap((value: unknown) => {
          if (
            typeof value !== 'object' ||
            value === null ||
            !('answeredAt' in value) ||
            !('score' in value) ||
            typeof value.answeredAt !== 'string' ||
            typeof value.score !== 'number' ||
            !Number.isFinite(value.score) ||
            value.score < 0 ||
            value.score > 100
          )
            return []
          const date = value.answeredAt
          if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || dayKey(parseDayKey(date)) !== date) return []
          return [{ date, score: value.score }]
        })
        const current = prefs.stressRatings
        prefs.set({
          stressRatings: [
            ...current,
            ...incoming.filter(item => !current.some(existing => existing.date === item.date)),
          ],
        })
        weekly = incoming.length > 0
      }
      toast.show({
        message: [
          SETTINGS.data.import.result(result.added, result.skipped),
          parsed.invalid ? SETTINGS.importPartial.replace('{count}', String(parsed.invalid)) : '',
          weekly ? SETTINGS.importWeekly : '',
        ]
          .filter(Boolean)
          .join(' '),
      })
    } catch {
      toast.show({ message: SETTINGS.data.import.invalid })
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }
  const remove = async (): Promise<void> => {
    if (busy) return
    setBusy(true)
    try {
      await getRepo().clear()
      prefs.reset()
      setDeleteStep(0)
      toast.show({ message: SETTINGS.data.deleteAll.done })
      navigate('/welcome')
    } catch {
      toast.show({ message: SETTINGS.operationFailed })
      setBusy(false)
    }
  }
  return (
    <PageFrame title={SETTINGS.title}>
      <NavBar backTo="/" backLabel={NAV.today} />
      <h1 tabIndex={-1}>{SETTINGS.title}</h1>
      <div className={styles.layout}>
        <nav className={styles.contents} aria-label={SETTINGS.navigation}>
          {groups.map(([id, title]) => (
            <a key={id} href={`#${id}`}>
              {title}
            </a>
          ))}
        </nav>
        <div className={styles.body}>
          <Section id="appearance" className={styles.group} title={SETTINGS.appearance.title}>
            <Segmented
              label={SETTINGS.appearance.title}
              value={prefs.theme}
              onChange={(theme: ThemePref) => prefs.set({ theme })}
              options={Object.entries(SETTINGS.appearance.theme).map(([value, label]) => ({
                value: value as ThemePref,
                label,
              }))}
            />
          </Section>
          <Section id="sound" className={styles.group} title={SETTINGS.sound.title}>
            <ListGroup>
              <NavRow
                label={SETTINGS.sound.defaults.label}
                hint={SETTINGS.sound.defaults.help}
                to="/settings/sounds"
              />
              {(Object.entries(SETTINGS.sound.volume) as [Bus, string][]).map(([bus, label]) => (
                <StackRow key={bus} label={label} value={percent(prefs.volume[bus])}>
                  {({ labelId }) => (
                    <Slider
                      min={0}
                      max={100}
                      step={5}
                      majorStep={25}
                      value={prefs.volume[bus]}
                      onChange={value => prefs.setVolume(bus, value)}
                      valueText={percent}
                      labelledBy={labelId}
                    />
                  )}
                </StackRow>
              ))}
              <StackRow
                label={SETTINGS.sound.cueStyle.label}
                hint={SETTINGS.sound.cueStyle.options[prefs.cueStyle].help}
              >
                {({ labelId }) => (
                  <Segmented
                    labelledBy={labelId}
                    value={prefs.cueStyle}
                    onChange={(cueStyle: CueStyle) => prefs.set({ cueStyle })}
                    options={Object.entries(SETTINGS.sound.cueStyle.options).map(([value, item]) => ({
                      value: value as CueStyle,
                      label: item.name,
                    }))}
                  />
                )}
              </StackRow>
              <CuePreview style={prefs.cueStyle} />
              <ToggleRow
                label={SETTINGS.sound.bells.label}
                hint={SETTINGS.sound.bells.help}
                checked={prefs.bells}
                onChange={bells => prefs.set({ bells })}
              />
              <StackRow label={SETTINGS.sound.interval.label} hint={SETTINGS.sound.interval.help}>
                {({ labelId }) => (
                  <Segmented
                    labelledBy={labelId}
                    value={prefs.intervalBell}
                    onChange={intervalBell => prefs.set({ intervalBell })}
                    options={([0, 5, 10] as const).map(value => ({
                      value,
                      label: value ? SETTINGS.sound.interval.every(value) : SETTINGS.sound.interval.off,
                    }))}
                  />
                )}
              </StackRow>
              <ToggleRow
                label={SETTINGS.sound.cues.label}
                hint={SETTINGS.sound.cues.help}
                checked={prefs.cues}
                onChange={cues => prefs.set({ cues })}
              />
              {'vibrate' in navigator && (
                <ToggleRow
                  label={SETTINGS.sound.haptics.label}
                  hint={SETTINGS.sound.haptics.help}
                  checked={prefs.haptics}
                  onChange={haptics => prefs.set({ haptics })}
                />
              )}
            </ListGroup>
          </Section>
          <Section id="guidance" className={styles.group} title={SETTINGS.guidance.title}>
            <StackRow
              label={SETTINGS.guidance.level.label}
              hint={SETTINGS.guidance.level.options[prefs.guidance].help}
            >
              {({ labelId }) => (
                <Segmented
                  labelledBy={labelId}
                  value={prefs.guidance}
                  onChange={guidance => prefs.set({ guidance })}
                  options={Object.entries(SETTINGS.guidance.level.options).map(([value, option]) => ({
                    value: value as typeof prefs.guidance,
                    label: option.name,
                  }))}
                />
              )}
            </StackRow>
            <p className={styles.note}>{SETTINGS.guidance.level.note}</p>
            <ToggleRow
              label={SETTINGS.guidance.captionCue.label}
              hint={SETTINGS.guidance.captionCue.help}
              checked={prefs.captionCue}
              onChange={captionCue => prefs.set({ captionCue })}
            />
          </Section>
          <Section id="practice" className={styles.group} title={SETTINGS.practice.title}>
            <Row
              label={SETTINGS.practice.leadIn.label}
              hint={SETTINGS.practice.leadIn.help}
              end={
                <Stepper
                  label={SETTINGS.practice.leadIn.label}
                  min={0}
                  max={10}
                  value={prefs.leadIn}
                  onChange={leadIn => prefs.set({ leadIn })}
                  format={SETTINGS.practice.leadIn.value}
                />
              }
            />
            <ToggleRow
              label={SETTINGS.practice.silentEnd.label}
              hint={SETTINGS.practice.silentEnd.help}
              checked={prefs.silentEnd}
              onChange={silentEnd => prefs.set({ silentEnd })}
            />
            <ToggleRow
              label={SETTINGS.practice.checkin.label}
              hint={SETTINGS.practice.checkin.help}
              checked={prefs.checkin.prePost}
              onChange={prePost => prefs.set({ checkin: { prePost } })}
            />
            <ToggleRow
              label={SETTINGS.practice.weekly.label}
              hint={SETTINGS.practice.weekly.help}
              checked={prefs.weeklyStress}
              onChange={weeklyStress => prefs.set({ weeklyStress })}
            />
          </Section>
          <Section id="reminders" className={styles.group} title={SETTINGS.reminder.title}>
            <NavRow label={SETTINGS.reminder.title} hint={SETTINGS.reminder.intro} to="/settings/reminders" />
          </Section>
          <Section id="safety" className={styles.group} title={SETTINGS.safety.title}>
            <ListGroup>
              <NavRow
                label={SETTINGS.safety.screening.label}
                hint={SETTINGS.safety.screening.help}
                to="/settings/safety"
              />
              <NavRow label={SETTINGS.safety.stop.label} hint={SETTINGS.safety.stop.help} to="/help#stop" />
              <NavRow label={SETTINGS.safety.help.label} hint={SETTINGS.safety.help.help} to="/help" />
              <NavRow
                label={SETTINGS.safety.monthly.label}
                hint={SETTINGS.safety.monthly.help}
                to="/settings/monthly"
              />
            </ListGroup>
          </Section>
          <Section id="data" className={styles.group} title={SETTINGS.data.title}>
            <Row label={SETTINGS.data.storage.label} hint={SETTINGS.data.storage[storage]} />
            <p className={styles.note}>{SETTINGS.data.storage.clearWarning}</p>
            <div className={styles.actions}>
              {(['json', 'csv'] as const).map(format => (
                <Button
                  key={format}
                  icon="download"
                  aria-disabled={loading}
                  onClick={() => {
                    if (!loading) exportRecords(format, records, prefs.stressRatings)
                  }}
                >
                  {SETTINGS.data.export[format]}
                </Button>
              ))}
            </div>
            <p className={styles.note}>{SETTINGS.data.export.help}</p>
            <div className={styles.actions}>
              <Button
                icon="upload"
                aria-disabled={busy}
                onClick={() => {
                  if (!busy) input.current?.click()
                }}
              >
                {SETTINGS.data.import.label}
              </Button>
              <input
                ref={input}
                type="file"
                accept=".json,application/json"
                hidden
                onChange={event => {
                  const file = event.target.files?.[0]
                  if (file) void importFile(file)
                }}
              />
            </div>
            <p className={styles.note}>{SETTINGS.data.import.help}</p>
            <NavRow label={SETTINGS.data.privacy.label} to="/settings/privacy" />
            <Button variant="danger" onClick={() => setDeleteStep(1)}>
              {SETTINGS.data.deleteAll.label}
            </Button>
          </Section>
          <Section id="about" className={styles.group} title={ABOUT.title}>
            <ListGroup>
              <NavRow label={DISCLAIMERS.full.title} to="/settings/about" />
              <Row label={SETTINGS.actions.version} end="1.0.0" />
              <NavRow label={SETTINGS.actions.licenses} to="/settings/fonts" />
            </ListGroup>
          </Section>
        </div>
      </div>
      <ConfirmDialog
        open={deleteStep > 0}
        title={deleteStep === 1 ? SETTINGS.data.deleteAll.first.title : SETTINGS.data.deleteAll.second.title}
        body={deleteStep === 1 ? SETTINGS.data.deleteAll.first.body : SETTINGS.data.deleteAll.second.body}
        cancelLabel={SETTINGS.data.deleteAll.first.cancel}
        confirmLabel={
          deleteStep === 1 ? SETTINGS.data.deleteAll.first.confirm : SETTINGS.data.deleteAll.second.confirm
        }
        tone={deleteStep === 2 ? 'danger' : 'default'}
        onCancel={() => setDeleteStep(0)}
        onConfirm={() => {
          if (deleteStep === 1) setDeleteStep(2)
          else void remove()
        }}
      />
    </PageFrame>
  )
}
export function DefaultSounds() {
  const [mode, setMode] = useState<SoundMode>('relax')
  const mix = usePrefs(s => s.sounds[mode])
  const set = usePrefs(s => s.set)
  return (
    <SettingsFrame title={SETTINGS.sound.defaults.label}>
      <SoundPicker
        mode={mode}
        value={mix}
        onModeChange={setMode}
        onChange={next => set({ sounds: { [mode]: next } })}
        preview
        volumes
      />
    </SettingsFrame>
  )
}
