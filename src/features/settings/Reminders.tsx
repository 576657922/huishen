import { useState } from 'react'
import { SETTINGS } from '@/content/copy'
import {
  adjustedDefaults,
  type CatalogPracticeId,
  isHidden,
  isOffered,
  PRACTICE_BY_ID,
  PRACTICES,
} from '@/content/practices'
import { buildPlanICS, downloadFile, MIME, REMINDER_FILE_NAME, type Reminders, usePrefs } from '@/data'
import {
  Button,
  ListGroup,
  NavRow,
  PracticeList,
  PracticeRow,
  Section,
  Segmented,
  Sheet,
  StackRow,
  TextField,
  ToggleRow,
  typeset,
  useToast,
} from '@/ui'
import { SettingsFrame } from './Frame'
import styles from './Settings.module.css'

type Field = 'cue' | 'action' | 'fallback'
const initial: Reminders = { ...SETTINGS.reminder.presets[0]!, weekday: '08:00', weekend: null }
export function ReminderSettings() {
  const prefs = usePrefs()
  const plan = prefs.reminders ?? initial
  const [sheet, setSheet] = useState<Field | null>(null)
  const [custom, setCustom] = useState('')
  const [practiceId, setPracticeId] = useState<CatalogPracticeId | null>(null)
  const [minutes, setMinutes] = useState(5)
  const toast = useToast()
  const patch = (next: Partial<Reminders>): void => prefs.set({ reminders: { ...plan, ...next } })
  const choose = (value: string): void => {
    if (sheet) patch({ [sheet]: value.trim() })
    setSheet(null)
    setPracticeId(null)
  }
  const open = (field: Field): void => {
    setSheet(field)
    setCustom(plan[field])
    setPracticeId(null)
  }
  const selected = practiceId ? PRACTICE_BY_ID[practiceId] : null
  return (
    <SettingsFrame title={SETTINGS.reminder.title}>
      <p className="ink-2">{SETTINGS.reminder.intro}</p>
      <p className={styles.sentence}>
        {SETTINGS.reminderSentence.before}
        <button
          className={styles.blank}
          type="button"
          aria-label={SETTINGS.reminder.fields.cue}
          onClick={() => open('cue')}
        >
          {plan.cue || SETTINGS.reminder.fields.custom}
        </button>
        {SETTINGS.reminderSentence.action}
        <button
          className={styles.blank}
          type="button"
          aria-label={SETTINGS.reminder.fields.action}
          onClick={() => open('action')}
        >
          {plan.action || SETTINGS.reminder.fields.custom}
        </button>
        {SETTINGS.reminderSentence.fallback}
        <button
          className={styles.blank}
          type="button"
          aria-label={SETTINGS.reminder.fields.fallback}
          onClick={() => open('fallback')}
        >
          {plan.fallback || SETTINGS.reminder.fields.custom}
        </button>
        {SETTINGS.reminderSentence.end}
      </p>
      <Section title={SETTINGS.actions.presets}>
        <ListGroup>
          {SETTINGS.reminder.presets.map(preset => (
            <NavRow
              key={preset.cue}
              label={preset.cue}
              hint={`${preset.action} · ${preset.fallback}`}
              onClick={() => patch(preset)}
            />
          ))}
        </ListGroup>
      </Section>
      <Section title={SETTINGS.reminder.fields.time}>
        {(['weekday', 'weekend'] as const).map(key => (
          <div key={key}>
            <ToggleRow
              label={SETTINGS.reminder.fields[key]}
              checked={plan[key] !== null}
              onChange={checked => patch({ [key]: checked ? '08:00' : null })}
              hint={plan[key] === null ? SETTINGS.reminder.fields.off : undefined}
            />
            {plan[key] !== null && (
              <label className={styles.time}>
                <span className="vh">{SETTINGS.reminder.fields[key]}</span>
                <input
                  className={styles.field}
                  type="time"
                  value={plan[key] ?? ''}
                  onChange={event => patch({ [key]: event.target.value || null })}
                />
              </label>
            )}
          </div>
        ))}
      </Section>
      <div className={styles.actions}>
        <Button
          variant="primary"
          icon="calendar"
          block
          onClick={() => {
            if (!plan.weekday && !plan.weekend) {
              toast.show({ message: SETTINGS.calendarEmpty })
              return
            }
            try {
              prefs.set({ reminders: plan })
              downloadFile(
                REMINDER_FILE_NAME,
                MIME.ics,
                buildPlanICS(plan, { startDate: new Date(), url: `${window.location.origin}/` }),
              )
            } catch {
              toast.show({ message: SETTINGS.operationFailed })
            }
          }}
        >
          {SETTINGS.reminder.calendar.button}
        </Button>
      </div>
      <ol className={styles.helpList}>
        {SETTINGS.reminder.calendar.help.map(line => (
          <li key={line}>{typeset(line)}</li>
        ))}
      </ol>
      <Sheet
        open={sheet !== null}
        onClose={() => setSheet(null)}
        title={sheet ? SETTINGS.reminder.fields[sheet] : ''}
        closeButton
      >
        {sheet === 'cue' && (
          <ListGroup>
            {SETTINGS.reminder.cues.map(cue => (
              <NavRow key={cue} label={cue} onClick={() => choose(cue)} />
            ))}
          </ListGroup>
        )}
        {sheet === 'fallback' && (
          <ListGroup>
            {SETTINGS.reminder.fallbacks.map(fallback => (
              <NavRow key={fallback} label={fallback} onClick={() => choose(fallback)} />
            ))}
          </ListGroup>
        )}
        {sheet === 'action' && (
          <>
            <PracticeList>
              {PRACTICES.filter(
                practice =>
                  isOffered(practice.id) &&
                  !isHidden(practice.id, prefs.safety.screening) &&
                  practice.kind !== 'assessment',
              ).map(practice => (
                <PracticeRow
                  key={practice.id}
                  practice={practice}
                  minutes={adjustedDefaults(practice.id, prefs.safety.screening).defaultMinutes}
                  onClick={() => {
                    setPracticeId(practice.id)
                    setMinutes(adjustedDefaults(practice.id, prefs.safety.screening).defaultMinutes)
                  }}
                />
              ))}
            </PracticeList>
            {selected && (
              <>
                <StackRow label={selected.name}>
                  {({ labelId }) => (
                    <Segmented
                      labelledBy={labelId}
                      value={minutes}
                      onChange={setMinutes}
                      options={adjustedDefaults(selected.id, prefs.safety.screening)
                        .durations.filter(value => value > 0)
                        .map(value => ({ value, label: String(value) }))}
                    />
                  )}
                </StackRow>
                <Button
                  variant="primary"
                  block
                  onClick={() => choose(SETTINGS.reminder.actionText(minutes, selected.name))}
                >
                  {SETTINGS.actions.save}
                </Button>
              </>
            )}
          </>
        )}
        <Section title={SETTINGS.reminder.fields.custom}>
          <TextField
            label={sheet ? SETTINGS.reminder.fields[sheet] : SETTINGS.reminder.fields.custom}
            value={custom}
            onChange={setCustom}
            maxLength={80}
          />
          <div className={styles.actions}>
            <Button
              variant="primary"
              aria-disabled={!custom.trim()}
              onClick={() => {
                if (custom.trim()) choose(custom)
              }}
            >
              {SETTINGS.actions.save}
            </Button>
          </div>
        </Section>
      </Sheet>
    </SettingsFrame>
  )
}
