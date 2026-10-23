import { useState } from 'react'
import { useNavigate } from 'react-router'
import { SETTINGS } from '@/content/copy'
import { AFTER_PRACTICE, HEALTH_CHECK, type MonthlyAnswer, monthlyCheckResult } from '@/content/safety'
import { type Screening, usePrefs } from '@/data'
import { dayKey } from '@/lib/date'
import { Button, ChoiceGroup, DisclosureRow, Section, ToggleRow, typeset, useToast } from '@/ui'
import { HelpNumbers } from '@/widgets/HelpNumbers'
import { SettingsFrame } from './Frame'
import styles from './Settings.module.css'

const empty = Object.fromEntries(HEALTH_CHECK.items.map(item => [item.id, false])) as unknown as Screening
export function HealthSettings() {
  const prefs = usePrefs()
  const [answers, setAnswers] = useState<Screening>(() => prefs.safety.screening ?? empty)
  const [notices, setNotices] = useState<Set<string>>(() => new Set())
  const navigate = useNavigate()
  const toast = useToast()
  const save = (screening: Screening | null): void => {
    prefs.set({ safety: { screening } })
    toast.show({ message: SETTINGS.actions.saved })
    navigate('/settings')
  }
  return (
    <SettingsFrame title={HEALTH_CHECK.title}>
      <p className="ink-2">{typeset(HEALTH_CHECK.intro)}</p>
      <p className={styles.note}>{HEALTH_CHECK.privacy}</p>
      <Section title={HEALTH_CHECK.question}>
        {HEALTH_CHECK.items.map(item => (
          <div key={item.id}>
            <ToggleRow
              label={item.label}
              hint={item.hint}
              checked={answers[item.id]}
              onChange={checked => setAnswers(previous => ({ ...previous, [item.id]: checked }))}
            />
            {answers[item.id] && (
              <div className={styles.adaptation}>
                <p>{typeset(item.adaptation)}</p>
                <DisclosureRow label={SETTINGS.safety.why}>{typeset(item.why)}</DisclosureRow>
              </div>
            )}
          </div>
        ))}
        {HEALTH_CHECK.notices.map(item => (
          <div key={item.id}>
            <ToggleRow
              label={item.label}
              hint={HEALTH_CHECK.unsaved}
              checked={notices.has(item.id)}
              onChange={checked =>
                setNotices(previous => {
                  const next = new Set(previous)
                  if (checked) next.add(item.id)
                  else next.delete(item.id)
                  return next
                })
              }
            />
            {notices.has(item.id) && (
              <div className={styles.adaptation}>
                {item.response.map(line => (
                  <p key={line}>{typeset(line)}</p>
                ))}
                {item.showHelp && <HelpNumbers variant="grid" />}
              </div>
            )}
          </div>
        ))}
      </Section>
      <div className={styles.actions}>
        <Button variant="primary" onClick={() => save(answers)}>
          {HEALTH_CHECK.save}
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            setAnswers(empty)
            setNotices(new Set())
          }}
        >
          {HEALTH_CHECK.none}
        </Button>
        <Button variant="quiet" onClick={() => save(null)}>
          {SETTINGS.actions.clear}
        </Button>
      </div>
    </SettingsFrame>
  )
}
export function MonthlySettings() {
  const prefs = usePrefs()
  const [answers, setAnswers] = useState<Record<string, MonthlyAnswer>>({})
  const [selfHarm, setSelfHarm] = useState<'yes' | 'no' | null>(null)
  const copy = AFTER_PRACTICE.monthly
  const complete = copy.items.every(item => answers[item.id] !== undefined)
  const result = complete ? monthlyCheckResult(Object.values(answers)) : null
  const toast = useToast()
  const navigate = useNavigate()
  const finish = (): void => {
    prefs.set({ safety: { monthlyCheckedOn: dayKey(new Date()) } })
    toast.show({ message: SETTINGS.actions.saved })
    navigate('/settings')
  }
  return (
    <SettingsFrame title={copy.title}>
      <p className="ink-2">{typeset(copy.intro)}</p>
      <ToggleRow
        label={SETTINGS.safety.monthly.label}
        hint={SETTINGS.safety.monthly.help}
        checked={prefs.safety.monthlyCheck}
        onChange={monthlyCheck => prefs.set({ safety: { monthlyCheck } })}
      />
      <Section title={copy.question}>
        {copy.items.map(item => (
          <div key={item.id} className={styles.question}>
            <p id={`monthly-${item.id}`}>{item.label}</p>
            <ChoiceGroup
              className={styles.monthlyChoices}
              labelledBy={`monthly-${item.id}`}
              options={copy.answers}
              value={answers[item.id] ?? null}
              onChange={value => setAnswers(previous => ({ ...previous, [item.id]: value }))}
            />
          </div>
        ))}
      </Section>
      {result && <p className={styles.result}>{typeset(copy.results[result])}</p>}
      <Section title={copy.selfHarm.question}>
        <ChoiceGroup
          label={copy.selfHarm.question}
          value={selfHarm}
          onChange={setSelfHarm}
          options={[
            { value: 'no', label: copy.selfHarm.no },
            { value: 'yes', label: copy.selfHarm.yes },
          ]}
        />
        {selfHarm === 'yes' && (
          <div className={styles.adaptation}>
            {copy.selfHarm.response.map(line => (
              <p key={line}>{typeset(line)}</p>
            ))}
            <HelpNumbers variant="grid" />
          </div>
        )}
      </Section>
      <div className={styles.actions}>
        <Button variant="primary" onClick={finish}>
          {SETTINGS.actions.save}
        </Button>
        <Button variant="quiet" onClick={finish}>
          {HEALTH_CHECK.skip}
        </Button>
      </div>
    </SettingsFrame>
  )
}
